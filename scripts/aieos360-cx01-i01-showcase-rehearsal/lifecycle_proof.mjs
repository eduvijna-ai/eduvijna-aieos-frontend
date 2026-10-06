#!/usr/bin/env node
/**
 * CI lifecycle proof: canonical reset, four-role runtime, full operator start/status/stop.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalStop, runNodeSync } from "./proof_orchestration.mjs";
import { repoRoot, statusPath } from "./paths.mjs";

const scriptDir = join(repoRoot, "scripts/aieos360-cx01-i01-showcase-rehearsal");
const backendRoot = process.env.AIEOS_BACKEND_ROOT;
if (!backendRoot) {
  console.error("AIEOS_BACKEND_ROOT is required");
  process.exit(1);
}

const managedStartEnv = {
  AIEOS360_CX01_I01_SHOWCASE_SKIP_RESET: "1",
  AIEOS360_CX01_I01_SHOWCASE_START_MODE: "managed",
};

function runPython(script, timeoutMs = 600_000) {
  const result = spawnSync(
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
        ].join(process.platform === "win32" ? ";" : ":"),
      },
      encoding: "utf8",
      timeout: timeoutMs,
    },
  );
  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    throw new Error(`${script} failed with ${result.status}`);
  }
  return result;
}

const reset = runNodeSync("reset.mjs", {}, 600_000);
if (reset.status !== 0) {
  console.error(reset.stdout);
  console.error(reset.stderr);
  throw new Error(`lifecycle canonical reset.mjs failed with ${reset.status}`);
}

let stackStarted = false;
let proofError = null;
try {
  const start = runNodeSync("start.mjs", managedStartEnv, 600_000);
  if (start.status !== 0) {
    console.error(start.stdout);
    console.error(start.stderr);
    throw new Error(`start.mjs failed with ${start.status}`);
  }
  stackStarted = true;

  runPython("four_role_runtime_proof.py");
  const status = runNodeSync(
    "status.mjs",
    { AIEOS360_CX01_I01_SHOWCASE_REQUIRE_LIVE: "1" },
    300_000,
  );
  if (status.status !== 0) {
    console.error(status.stdout);
    console.error(status.stderr);
    throw new Error(`status.mjs failed with ${status.status}`);
  }
} catch (error) {
  proofError = error;
} finally {
  if (stackStarted) {
    const stop = canonicalStop();
    if (stop.status !== 0) {
      console.error(stop.stdout);
      console.error(stop.stderr);
      proofError =
        proofError ?? new Error(`stop.mjs failed with ${stop.status}`);
    }
  } else {
    canonicalStop();
  }
}

if (proofError) {
  throw proofError;
}

if (!existsSync(statusPath)) {
  throw new Error("status file missing after stop");
}
const finalStatus = JSON.parse(readFileSync(statusPath, "utf8"));
if (finalStatus.phase !== "stopped") {
  throw new Error(`expected phase stopped after stop; got ${finalStatus.phase}`);
}

const proof = {
  lifecycle: [
    "reset",
    "canonical_start",
    "four_role_runtime_http",
    "status_live",
    "canonical_stop",
  ],
  reset_exit_status: reset.status,
  final_phase: finalStatus.phase,
  classification: "NON_PRODUCTION",
  operator_path: "start.mjs",
  managed_start: true,
  cleanup: "try_finally_canonical_stop",
};
const tmpDir = join(repoRoot, "tmp");
mkdirSync(tmpDir, { recursive: true });
writeFileSync(
  join(tmpDir, "aieos360-cx01-i01-showcase-lifecycle-proof.json"),
  JSON.stringify(proof, null, 2) + "\n",
  "utf8",
);
console.log(JSON.stringify(proof, null, 2));
