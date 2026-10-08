#!/usr/bin/env node
/** CI lifecycle proof: reset, managed start, four-role HTTP, live status, explicit stop. */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertPortsReleased,
  collectManagedEvidence,
  DEFAULT_GOVERNED_APP_PORTS,
} from "./managed_evidence.mjs";
import { readProcessRegistry, resolveStopTimeoutMs } from "./process_group.mjs";
import { dbReportPath, repoRoot, statusPath } from "./paths.mjs";

const scriptDir = join(repoRoot, "scripts/aieos360-cx01-i01r9-showcase-rehearsal");
const backendRoot = process.env.AIEOS_BACKEND_ROOT;
if (!backendRoot) {
  console.error("AIEOS_BACKEND_ROOT is required");
  process.exit(1);
}

function runNode(script, extraEnv = {}, timeoutMs = 600_000) {
  return spawnSync("node", [join(scriptDir, script)], {
    cwd: repoRoot,
    env: { ...process.env, ...extraEnv },
    encoding: "utf8",
    timeout: timeoutMs,
  });
}

function runPython(script, timeoutMs = 600_000) {
  return spawnSync(
    process.env.AIEOS360_CX01_I01_SHOWCASE_UV || "uv",
    ["run", "python", join(scriptDir, script)],
    {
      cwd: backendRoot,
      env: {
        ...process.env,
        AIEOS_BACKEND_ROOT: backendRoot,
        PYTHONPATH: [
          join(backendRoot, "src"),
          backendRoot,
          scriptDir,
        ].join(":"),
      },
      encoding: "utf8",
      timeout: timeoutMs,
    },
  );
}

const reset = runNode("reset.mjs");
if (reset.status !== 0) {
  console.error(reset.stdout);
  console.error(reset.stderr);
  process.exit(reset.status ?? 1);
}

let stackStarted = false;
let proofError = null;
let governedPortsBeforeStop = [];
let liveBeforeStop = null;
let registryChildrenBeforeCorruptStop = 0;
const stopTimeoutMs = resolveStopTimeoutMs();
let stopWatchElapsedMs = 0;
let resetWhileLiveRefused = false;
let malformedStatusStopRecovery = false;
let malformedDbReportStopRecovery = false;

try {
  const start = runNode("start.mjs", {
    AIEOS360_CX01_I01_SHOWCASE_SKIP_RESET: "1",
  });
  if (start.status !== 0) {
    console.error(start.stdout);
    console.error(start.stderr);
    throw new Error(`start.mjs failed with ${start.status}`);
  }
  stackStarted = true;

  const runtime = runPython("four_role_runtime_proof.py");
  if (runtime.status !== 0) {
    console.error(runtime.stdout);
    console.error(runtime.stderr);
    throw new Error("four_role_runtime_proof.py failed");
  }

  const status = runNode("status.mjs");
  if (status.status !== 0) {
    console.error(status.stdout);
    console.error(status.stderr);
    throw new Error(`status.mjs failed with ${status.status}`);
  }

  liveBeforeStop = collectManagedEvidence();
  if (liveBeforeStop.live_process_count !== 8) {
    throw new Error(
      `expected 8 live managed processes before stop; got ${liveBeforeStop.live_process_count}`,
    );
  }
  const runningStatus = JSON.parse(readFileSync(statusPath, "utf8"));
  if (runningStatus.phase !== "running") {
    throw new Error(`expected running phase before reset refusal; got ${runningStatus.phase}`);
  }
  governedPortsBeforeStop = runningStatus.governed_ports ?? DEFAULT_GOVERNED_APP_PORTS;
  registryChildrenBeforeCorruptStop = readProcessRegistry().children?.length ?? 0;
  if (registryChildrenBeforeCorruptStop !== 8) {
    throw new Error(
      `expected 8 registry children before reset refusal; got ${registryChildrenBeforeCorruptStop}`,
    );
  }

  const resetWhileLive = runNode("reset.mjs");
  if (resetWhileLive.status === 0) {
    throw new Error("reset.mjs must fail while managed stack is live");
  }
  resetWhileLiveRefused = true;

  const statusAfterRefusedReset = JSON.parse(readFileSync(statusPath, "utf8"));
  if (statusAfterRefusedReset.phase !== "running") {
    throw new Error(
      `operator phase must remain running after refused reset; got ${statusAfterRefusedReset.phase}`,
    );
  }
  const liveAfterRefusedReset = collectManagedEvidence();
  if (liveAfterRefusedReset.live_process_count !== 8) {
    throw new Error(
      `expected 8 live processes after refused reset; got ${liveAfterRefusedReset.live_process_count}`,
    );
  }
  const registryAfterRefusedReset = readProcessRegistry().children?.length ?? 0;
  if (registryAfterRefusedReset !== 8) {
    throw new Error(
      `registry must remain intact after refused reset; got ${registryAfterRefusedReset} children`,
    );
  }

  const statusRecheck = runNode("status.mjs");
  if (statusRecheck.status !== 0) {
    console.error(statusRecheck.stdout);
    console.error(statusRecheck.stderr);
    throw new Error("status.mjs must remain healthy after refused reset");
  }

  writeFileSync(statusPath, "{ truncated operator status metadata", "utf8");
  malformedStatusStopRecovery = true;
  if (existsSync(dbReportPath)) {
    writeFileSync(dbReportPath, "{ truncated db report metadata", "utf8");
    malformedDbReportStopRecovery = true;
  }

  const stopStartedAt = Date.now();
  const stop = runNode("stop.mjs");
  stopWatchElapsedMs = Date.now() - stopStartedAt;
  if (stop.status !== 0) {
    console.error(stop.stdout);
    console.error(stop.stderr);
    throw new Error(`stop.mjs failed with ${stop.status}`);
  }
} catch (error) {
  proofError = error;
  if (stackStarted) {
    const emergencyStop = runNode("stop.mjs");
    if (emergencyStop.status !== 0) {
      console.error(emergencyStop.stdout);
      console.error(emergencyStop.stderr);
    }
  }
}

if (proofError) {
  console.error(proofError);
  process.exit(1);
}

if (!existsSync(statusPath)) {
  throw new Error("status file missing after stop");
}
const finalStatus = JSON.parse(readFileSync(statusPath, "utf8"));
if (finalStatus.phase !== "stopped") {
  throw new Error(`expected phase stopped; got ${finalStatus.phase}`);
}
if (!finalStatus.status_metadata_recovered) {
  throw new Error("final stop status must record malformed status metadata recovery");
}
if (malformedDbReportStopRecovery && !finalStatus.db_report_metadata_recovered) {
  throw new Error("final stop status must record malformed db report metadata recovery");
}

const liveAfterStop = collectManagedEvidence();
if (liveAfterStop.live_process_count !== 0) {
  throw new Error(
    `expected no live managed processes after stop; got ${liveAfterStop.live_process_count}`,
  );
}

const portsToCheck =
  finalStatus.governed_ports_checked?.length > 0
    ? finalStatus.governed_ports_checked
    : governedPortsBeforeStop.length > 0
      ? governedPortsBeforeStop
      : DEFAULT_GOVERNED_APP_PORTS;
await assertPortsReleased(portsToCheck);

const stopTiming = finalStatus.stop_timing ?? {};
if (!stopTiming.within_deadline) {
  throw new Error(
    `stop exceeded shared deadline: ${JSON.stringify(stopTiming)}`,
  );
}
if (stopTiming.stop_elapsed_ms > stopTimeoutMs) {
  throw new Error(
    `stop_elapsed_ms ${stopTiming.stop_elapsed_ms} > stop_timeout_ms ${stopTimeoutMs}`,
  );
}

const proof = {
  lifecycle: [
    "reset",
    "managed_start",
    "four_role_runtime_http",
    "status_live",
    "reset_refused_while_live",
    "runtime_still_healthy",
    "malformed_status_metadata",
    "malformed_db_report_metadata",
    "explicit_stop_with_recovery",
  ],
  final_phase: finalStatus.phase,
  classification: "NON_PRODUCTION",
  managed_linux_process_groups: true,
  reset_while_live_refused: resetWhileLiveRefused,
  malformed_status_stop_recovery: malformedStatusStopRecovery,
  malformed_db_report_stop_recovery: malformedDbReportStopRecovery,
  normal_explicit_stop_cleanup: {
    live_process_count_before_stop: liveBeforeStop?.live_process_count,
    live_process_count_after_stop: liveAfterStop.live_process_count,
    governed_app_ports_released: portsToCheck,
    stop_timeout_ms: stopTimeoutMs,
    stop_timing: stopTiming,
    stop_watch_elapsed_ms: stopWatchElapsedMs,
    within_shared_stop_deadline: true,
    status_metadata_recovered: finalStatus.status_metadata_recovered,
    db_report_metadata_recovered: finalStatus.db_report_metadata_recovered,
  },
};
const tmpDir = join(repoRoot, "tmp");
mkdirSync(tmpDir, { recursive: true });
writeFileSync(
  join(tmpDir, "aieos360-cx01-i01-showcase-lifecycle-proof.json"),
  JSON.stringify(proof, null, 2) + "\n",
  "utf8",
);
console.log(JSON.stringify(proof, null, 2));
