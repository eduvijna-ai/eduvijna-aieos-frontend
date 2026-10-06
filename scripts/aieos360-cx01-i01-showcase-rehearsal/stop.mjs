#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { CX01_SHOWCASE_CONTAINER } from "./constants.mjs";
import {
  inspectOwnedContainer,
  verifyProcessIdentity,
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
  const identity = verifyProcessIdentity(entry.pid, entry);
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
  const exited = await waitForPidExit(entry.pid, 15_000);
  if (!exited && isPidAlive(entry.pid)) {
    survivors.push(entry);
    try {
      process.kill(entry.pid, "SIGKILL");
    } catch {
      /* ignore */
    }
    const forcedExit = await waitForPidExit(entry.pid, 5_000);
    if (!forcedExit && isPidAlive(entry.pid)) {
      failed.push({ ...entry, error: "process survived SIGTERM/SIGKILL" });
    }
  }
}

let containerRemoved = false;
let containerRemoveError = null;
let containerIdentity = null;
if (process.env.AIEOS360_CX01_I01_SHOWCASE_STOP_EXPECT_CONTAINER !== "0") {
  const inspect = inspectOwnedContainer(CX01_SHOWCASE_CONTAINER);
  if (inspect.ok) {
    containerIdentity = {
      containerId: inspect.containerId,
      containerName: CX01_SHOWCASE_CONTAINER,
    };
    const docker = spawnSync("docker", ["rm", "-f", CX01_SHOWCASE_CONTAINER], {
      encoding: "utf8",
    });
    if (docker.status === 0) {
      containerRemoved = true;
    } else if (docker.stderr?.includes("No such container")) {
      containerRemoved = false;
    } else {
      containerRemoveError = docker.stderr || docker.stdout || "docker rm failed";
    }
  } else if (!inspect.error?.includes("No such object")) {
    containerRemoveError = inspect.error;
  }
}

const phase =
  failed.length > 0 ||
  survivors.length > 0 ||
  rejected.length > 0 ||
  containerRemoveError
    ? "stop_failed"
    : "stopped";

writeOperatorStatus({
  phase,
  classification: "NON_PRODUCTION",
  stopped_at: new Date().toISOString(),
  container_removed: containerRemoved,
  container_identity: containerIdentity,
  signaled_processes: signaled,
  rejected_registry_entries: rejected,
  survivor_processes: survivors,
  failed_processes: failed,
  container_remove_error: containerRemoveError,
});

if (phase === "stopped") {
  writeProcessRegistry({ children: [] });
} else {
  writeProcessRegistry({
    children: [...survivors, ...failed.map((item) => ({ ...item, stop_failed: true }))],
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
    },
    null,
    2,
  ),
);
