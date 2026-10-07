#!/usr/bin/env node
/** CI lifecycle proof: reset, managed start, four-role HTTP, live status, explicit stop. */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot, statusPath } from "./paths.mjs";

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

  const status = runNode("status.mjs", {
    AIEOS360_CX01_I01_SHOWCASE_REQUIRE_LIVE: "1",
  });
  if (status.status !== 0) {
    console.error(status.stdout);
    console.error(status.stderr);
    throw new Error(`status.mjs failed with ${status.status}`);
  }
} catch (error) {
  proofError = error;
} finally {
  const stop = runNode("stop.mjs");
  if (stop.status !== 0) {
    console.error(stop.stdout);
    console.error(stop.stderr);
    proofError = proofError ?? new Error(`stop.mjs failed with ${stop.status}`);
  }
  if (stackStarted && stop.status !== 0) {
    proofError = proofError ?? new Error("stop failed after managed start");
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

const proof = {
  lifecycle: [
    "reset",
    "managed_start",
    "four_role_runtime_http",
    "status_live",
    "explicit_stop",
  ],
  final_phase: finalStatus.phase,
  classification: "NON_PRODUCTION",
  managed_linux_process_groups: true,
};
const tmpDir = join(repoRoot, "tmp");
mkdirSync(tmpDir, { recursive: true });
writeFileSync(
  join(tmpDir, "aieos360-cx01-i01-showcase-lifecycle-proof.json"),
  JSON.stringify(proof, null, 2) + "\n",
  "utf8",
);
console.log(JSON.stringify(proof, null, 2));
