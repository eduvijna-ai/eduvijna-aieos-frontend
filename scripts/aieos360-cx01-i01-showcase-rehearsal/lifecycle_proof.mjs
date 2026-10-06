#!/usr/bin/env node
/**
 * CI lifecycle proof: canonical reset, four-role composition, backend readiness,
 * live status, and governed stop/cleanup.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "./paths.mjs";
import { statusPath } from "./paths.mjs";

const scriptDir = join(repoRoot, "scripts/aieos360-cx01-i01-showcase-rehearsal");
const backendRoot = process.env.AIEOS_BACKEND_ROOT;
if (!backendRoot) {
  console.error("AIEOS_BACKEND_ROOT is required");
  process.exit(1);
}

function runNode(script, extraEnv = {}) {
  const result = spawnSync("node", [join(scriptDir, script)], {
    cwd: repoRoot,
    env: { ...process.env, ...extraEnv },
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    throw new Error(`${script} failed with ${result.status}`);
  }
  return result;
}

function runPython(script) {
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
    },
  );
  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    throw new Error(`${script} failed with ${result.status}`);
  }
  return result;
}

runNode("reset.mjs");
runPython("four_role_compose_proof.py");
runNode("start-backends.mjs");
runNode("status.mjs", { AIEOS360_CX01_I01_SHOWCASE_REQUIRE_LIVE: "1" });
runNode("stop.mjs", { AIEOS360_CX01_I01_SHOWCASE_STOP_EXPECT_CONTAINER: "0" });

if (!existsSync(statusPath)) {
  throw new Error("status file missing after stop");
}
const status = JSON.parse(readFileSync(statusPath, "utf8"));
if (status.phase !== "stopped") {
  throw new Error(`expected phase stopped after stop; got ${status.phase}`);
}

const proof = {
  lifecycle: ["reset", "four_role_compose", "start_backends", "status_live", "stop"],
  final_phase: status.phase,
  classification: "NON_PRODUCTION",
};
const tmpDir = join(repoRoot, "tmp");
mkdirSync(tmpDir, { recursive: true });
writeFileSync(
  join(tmpDir, "aieos360-cx01-i01-showcase-lifecycle-proof.json"),
  JSON.stringify(proof, null, 2) + "\n",
  "utf8",
);
console.log(JSON.stringify(proof, null, 2));
