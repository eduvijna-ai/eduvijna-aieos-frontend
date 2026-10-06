import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { repoRoot } from "./paths.mjs";

const scriptDir = join(repoRoot, "scripts/aieos360-cx01-i01-showcase-rehearsal");

export function runNodeSync(script, extraEnv = {}, timeoutMs = 600_000) {
  const result = spawnSync("node", [join(scriptDir, script)], {
    cwd: repoRoot,
    env: { ...process.env, ...extraEnv },
    encoding: "utf8",
    timeout: timeoutMs,
  });
  return result;
}

export function canonicalStop(extraEnv = {}) {
  return runNodeSync(
    "stop.mjs",
    {
      AIEOS360_CX01_I01_SHOWCASE_STOP_EXPECT_CONTAINER: "0",
      ...extraEnv,
    },
    120_000,
  );
}

export function runWithCanonicalStopAfterStart(runAfterStart) {
  let started = false;
  try {
    const outcome = runAfterStart();
    started = outcome?.started === true;
    if (outcome?.error) {
      throw outcome.error;
    }
    return outcome;
  } finally {
    if (started) {
      canonicalStop();
    }
  }
}
