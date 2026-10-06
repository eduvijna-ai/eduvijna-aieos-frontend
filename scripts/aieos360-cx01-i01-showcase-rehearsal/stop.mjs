#!/usr/bin/env node
import { existsSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { CX01_SHOWCASE_CONTAINER } from "./constants.mjs";
import {
  isPidAlive,
  readProcessRegistry,
  writeOperatorStatus,
  writeProcessRegistry,
} from "./process_registry.mjs";
import { processesPath } from "./paths.mjs";

const registry = readProcessRegistry();
const stopped = [];
const failed = [];

for (const entry of registry.children ?? []) {
  if (!entry?.pid) {
    continue;
  }
  if (!isPidAlive(entry.pid)) {
    stopped.push({ ...entry, already_dead: true });
    continue;
  }
  try {
    process.kill(entry.pid, "SIGTERM");
    stopped.push(entry);
  } catch (error) {
    failed.push({ ...entry, error: String(error) });
  }
}

let containerRemoved = false;
let containerRemoveError = null;
if (process.env.AIEOS360_CX01_I01_SHOWCASE_STOP_EXPECT_CONTAINER !== "0") {
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
}

const phase = failed.length > 0 || containerRemoveError ? "stop_failed" : "stopped";
writeOperatorStatus({
  phase,
  classification: "NON_PRODUCTION",
  stopped_at: new Date().toISOString(),
  container_removed: containerRemoved,
  stopped_processes: stopped,
  failed_processes: failed,
  container_remove_error: containerRemoveError,
});

writeProcessRegistry({ children: [] });
if (existsSync(processesPath)) {
  unlinkSync(processesPath);
}

if (phase === "stop_failed") {
  console.error(
    JSON.stringify(
      { phase, failed, containerRemoveError },
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
