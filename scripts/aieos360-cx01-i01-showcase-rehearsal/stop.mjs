#!/usr/bin/env node
import { CX01_SHOWCASE_CONTAINER } from "./constants.mjs";
import { removeOwnedContainer } from "./docker_ownership.mjs";
import {
  verifyRegistryEntryOwnership,
  waitForPidExit,
} from "./process_identity.mjs";
import {
  isPidAlive,
  readProcessRegistry,
  writeOperatorStatus,
  writeProcessRegistry,
} from "./process_registry.mjs";

const registry = readProcessRegistry();
const signaled = [];
const rejected = [];
const survivors = [];
const failed = [];

for (const entry of registry.children ?? []) {
  if (!entry?.pid) {
    continue;
  }
  if (!isPidAlive(entry.pid)) {
    signaled.push({ ...entry, already_dead: true });
    continue;
  }
  const identity = verifyRegistryEntryOwnership(entry.pid, entry);
  if (!identity.ok) {
    rejected.push({ ...entry, reason: identity.reason });
    continue;
  }
  try {
    process.kill(entry.pid, "SIGTERM");
    signaled.push(entry);
  } catch (error) {
    failed.push({ ...entry, error: String(error) });
  }
}

for (const entry of signaled.filter((item) => !item.already_dead)) {
  const exitedAfterTerm = await waitForPidExit(entry.pid, 15_000);
  if (exitedAfterTerm || !isPidAlive(entry.pid)) {
    continue;
  }

  let killed = false;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const preAttempt = verifyRegistryEntryOwnership(entry.pid, entry);
    if (!preAttempt.ok) {
      rejected.push({
        ...entry,
        reason: preAttempt.reason,
        stage: `pre_sigkill_attempt_${attempt}`,
      });
      break;
    }
    try {
      process.kill(entry.pid, "SIGKILL");
    } catch (error) {
      failed.push({ ...entry, error: String(error), stage: "sigkill" });
      break;
    }
    const exitedAfterKill = await waitForPidExit(entry.pid, 25_000);
    if (exitedAfterKill || !isPidAlive(entry.pid)) {
      killed = true;
      break;
    }
  }
  if (!killed && isPidAlive(entry.pid)) {
    survivors.push(entry);
    failed.push({ ...entry, error: "process survived SIGTERM/SIGKILL" });
  }
}

let containerRemoved = false;
let containerRemoveError = null;
let containerIdentity = null;
if (process.env.AIEOS360_CX01_I01_SHOWCASE_STOP_EXPECT_CONTAINER !== "0") {
  const removal = removeOwnedContainer(CX01_SHOWCASE_CONTAINER);
  if (removal.removed) {
    containerRemoved = true;
    containerIdentity = { containerId: removal.containerId };
  } else if (removal.missing) {
    containerRemoved = false;
  } else if (removal.error) {
    containerRemoveError = removal.error;
  }
}

const phase =
  failed.length > 0 || survivors.length > 0 || containerRemoveError
    ? "stop_failed"
    : "stopped";

writeOperatorStatus({
  phase,
  classification: "NON_PRODUCTION",
  stopped_at: new Date().toISOString(),
  container_removed: containerRemoved,
  container_identity: containerIdentity,
  signaled_processes: signaled.map(({ pid, role, script, already_dead }) => ({
    pid,
    role,
    script,
    already_dead: Boolean(already_dead),
  })),
  rejected_registry_entries: rejected,
  survivor_processes: survivors.map(({ pid, role, script }) => ({
    pid,
    role,
    script,
  })),
  failed_processes: failed,
  container_remove_error: containerRemoveError,
});

if (phase === "stopped") {
  writeProcessRegistry({ children: [] });
} else {
  const recoverable = survivors
    .filter((entry) => isPidAlive(entry.pid))
    .concat(
      failed
        .filter((item) => isPidAlive(item.pid))
        .map((item) => ({ ...item, stop_failed: true })),
    );
  writeProcessRegistry({
    children: recoverable,
    last_stop_failed_at: new Date().toISOString(),
  });
}

if (phase === "stop_failed") {
  console.error(
    JSON.stringify(
      { phase, rejected, survivors, failed, containerRemoveError },
      null,
      2,
    ),
  );
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      stopped: true,
      classification: "NON_PRODUCTION",
      container_removed: containerRemoved,
      phase,
      rejected_count: rejected.length,
    },
    null,
    2,
  ),
);
