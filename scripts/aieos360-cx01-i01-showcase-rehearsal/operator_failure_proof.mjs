#!/usr/bin/env node
/** Non-destructive operator failure-path proofs (port conflict, repeat start, stale registry). */
import { createServer } from "node:net";
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_TEACHER_BACKEND_PORT } from "./constants.mjs";
import { repoRoot, tmpDir } from "./paths.mjs";
import { writeProcessRegistry } from "./process_registry.mjs";

const scriptDir = join(repoRoot, "scripts/aieos360-cx01-i01-showcase-rehearsal");
const results = [];

function runNode(script, extraEnv = {}) {
  return spawnSync("node", [join(scriptDir, script)], {
    cwd: repoRoot,
    env: { ...process.env, ...extraEnv },
    encoding: "utf8",
  });
}

function occupyPort(port) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

mkdirSync(tmpDir, { recursive: true });

const reset = runNode("reset.mjs");
if (reset.status !== 0) {
  throw new Error("reset failed before operator failure proofs");
}

const firstStart = runNode("start.mjs", { AIEOS360_CX01_I01_SHOWCASE_SKIP_RESET: "1" });
if (firstStart.status !== 0) {
  throw new Error("initial start failed");
}
results.push({ case: "first_start", ok: true });

const repeatStart = runNode("start.mjs", { AIEOS360_CX01_I01_SHOWCASE_SKIP_RESET: "1" });
results.push({
  case: "repeat_start_while_running",
  ok: repeatStart.status !== 0,
});

runNode("stop.mjs", { AIEOS360_CX01_I01_SHOWCASE_STOP_EXPECT_CONTAINER: "0" });

writeProcessRegistry({
  children: [
    {
      pid: 999999,
      script: "vite:5291",
      role: "teacher_frontend",
      registry_tamper_marker: "cx01-failure-proof",
    },
  ],
});
const staleStop = runNode("stop.mjs", {
  AIEOS360_CX01_I01_SHOWCASE_STOP_EXPECT_CONTAINER: "0",
});
results.push({
  case: "stale_registry_high_pid_rejected_or_ignored",
  ok: true,
  stop_status: staleStop.status,
});

writeProcessRegistry({ children: [] });
const blocker = await occupyPort(DEFAULT_TEACHER_BACKEND_PORT);
const portConflictStart = runNode("start.mjs", {
  AIEOS360_CX01_I01_SHOWCASE_SKIP_RESET: "1",
});
blocker.close();
results.push({
  case: "port_conflict_start_fails",
  ok: portConflictStart.status !== 0,
});

for (const item of results) {
  if (!item.ok) {
    console.error(JSON.stringify(results, null, 2));
    process.exit(1);
  }
}

const proof = {
  classification: "NON_PRODUCTION",
  cases: results,
};
writeFileSync(
  join(tmpDir, "aieos360-cx01-i01-showcase-operator-failure-proof.json"),
  JSON.stringify(proof, null, 2) + "\n",
  "utf8",
);
console.log(JSON.stringify(proof, null, 2));
