#!/usr/bin/env node
/** Operator failure-path proofs with asserted outcomes (not hardcoded pass). */
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_TEACHER_BACKEND_PORT } from "./constants.mjs";
import { canonicalStop, runNodeSync } from "./proof_orchestration.mjs";
import {
  buildChildRegistryEntry,
  CHILD_OWNERSHIP_ENV,
  newChildOwnershipToken,
  newParentRunId,
  verifyRegistryEntryOwnership,
} from "./process_identity.mjs";
import { isPidAlive, readProcessRegistry, writeProcessRegistry } from "./process_registry.mjs";
import { tmpDir } from "./paths.mjs";

const results = [];

function assertCase(name, ok, detail = {}) {
  results.push({ case: name, ok, ...detail });
  if (!ok) {
    console.error(JSON.stringify(results, null, 2));
    process.exit(1);
  }
}

function occupyPort(port) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

function spawnIdleDecoy(extraEnv = {}) {
  return spawn(
    process.execPath,
    ["-e", "setInterval(()=>{}, 1_000_000)"],
    {
      env: { ...process.env, ...extraEnv },
      stdio: "ignore",
      detached: false,
    },
  );
}

mkdirSync(tmpDir, { recursive: true });

const reset = runNodeSync("reset.mjs", {}, 600_000);
assertCase("reset_before_failures", reset.status === 0, {
  status: reset.status,
});

const managedStartEnv = {
  AIEOS360_CX01_I01_SHOWCASE_SKIP_RESET: "1",
  AIEOS360_CX01_I01_SHOWCASE_START_MODE: "managed",
};

let stackStarted = false;
try {
  const firstStart = runNodeSync("start.mjs", managedStartEnv, 600_000);
  assertCase("first_start", firstStart.status === 0, { status: firstStart.status });
  stackStarted = true;

  const repeatStart = runNodeSync("start.mjs", managedStartEnv, 120_000);
  assertCase("repeat_start_while_running", repeatStart.status !== 0, {
    status: repeatStart.status,
  });
} finally {
  if (stackStarted) {
    const stop = canonicalStop();
    assertCase("stop_after_first_start", stop.status === 0, { status: stop.status });
    stackStarted = false;
  }
}

const unrelatedToken = newChildOwnershipToken();
const unrelatedDecoy = spawnIdleDecoy({
  [CHILD_OWNERSHIP_ENV]: unrelatedToken,
});
const tamperedEntry = buildChildRegistryEntry({
  script: "vite:5291",
  role: "teacher_frontend",
  pid: unrelatedDecoy.pid,
  parentRunId: newParentRunId(),
  ownershipToken: newChildOwnershipToken(),
});
writeProcessRegistry({ children: [tamperedEntry] });
const staleStop = runNodeSync("stop.mjs", {
  AIEOS360_CX01_I01_SHOWCASE_STOP_EXPECT_CONTAINER: "0",
});
const decoyAliveAfterStale = isPidAlive(unrelatedDecoy.pid);
assertCase("live_unrelated_decoy_rejected", decoyAliveAfterStale, {
  stop_status: staleStop.status,
  decoy_pid: unrelatedDecoy.pid,
});
assertCase("stale_registry_stop_succeeds_without_signaling", staleStop.status === 0, {
  status: staleStop.status,
});
assertCase(
  "stale_registry_does_not_signal_unrelated",
  verifyRegistryEntryOwnership(unrelatedDecoy.pid, tamperedEntry).ok === false,
);
try {
  unrelatedDecoy.kill("SIGKILL");
} catch {
  /* ignore */
}

writeProcessRegistry({ children: [] });

const sigtermResistantToken = newChildOwnershipToken();
const parentRunId = newParentRunId();
const resistant = spawn(
  process.execPath,
  [
    "-e",
    "process.on('SIGTERM',()=>{}); setInterval(()=>{}, 1_000_000);",
  ],
  {
    env: {
      ...process.env,
      [CHILD_OWNERSHIP_ENV]: sigtermResistantToken,
    },
    stdio: "ignore",
  },
);
const ownedResistantEntry = buildChildRegistryEntry({
  script: "cx01-failure-proof-resistant",
  role: "teacher-backend",
  pid: resistant.pid,
  parentRunId,
  ownershipToken: sigtermResistantToken,
});
writeProcessRegistry({ children: [ownedResistantEntry] });
const forcedStop = runNodeSync("stop.mjs", {
  AIEOS360_CX01_I01_SHOWCASE_STOP_EXPECT_CONTAINER: "0",
});
const resistantAlive = isPidAlive(resistant.pid);
assertCase("sigterm_resistant_owned_cleanup", forcedStop.status === 0 && !resistantAlive, {
  stop_status: forcedStop.status,
  resistant_alive: resistantAlive,
});

const repeatStop = runNodeSync("stop.mjs", {
  AIEOS360_CX01_I01_SHOWCASE_STOP_EXPECT_CONTAINER: "0",
});
assertCase("repeat_stop_on_empty_registry", repeatStop.status === 0, {
  status: repeatStop.status,
});

const blocker = await occupyPort(DEFAULT_TEACHER_BACKEND_PORT);
const portConflictStart = runNodeSync("start.mjs", managedStartEnv, 120_000);
blocker.close();
assertCase("port_conflict_start_fails", portConflictStart.status !== 0, {
  status: portConflictStart.status,
});

const proof = {
  classification: "NON_PRODUCTION",
  cases: results,
  registry_after_proof: readProcessRegistry(),
};
writeFileSync(
  join(tmpDir, "aieos360-cx01-i01-showcase-operator-failure-proof.json"),
  JSON.stringify(proof, null, 2) + "\n",
  "utf8",
);
console.log(JSON.stringify(proof, null, 2));
