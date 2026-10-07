#!/usr/bin/env node
/** Non-destructive selftest: shared stop-wide deadline stops multiple process groups. */
import { spawn } from "node:child_process";
import {
  appendProcessChild,
  linuxProcessStartTime,
  readProcessRegistry,
  resolveStopTimeoutMs,
  stopRegisteredProcessGroups,
  writeProcessRegistry,
} from "./process_group.mjs";

function spawnSleep(role) {
  const child = spawn("sleep", ["30"], { detached: true, stdio: "ignore" });
  child.unref();
  const pid = child.pid;
  const startTime = linuxProcessStartTime(pid);
  appendProcessChild({
    role,
    script: "sleep",
    pid,
    pgid: pid,
    startTime,
    port: null,
    spawned_at: new Date().toISOString(),
  });
}

writeProcessRegistry({ children: [] });
spawnSleep("proof-a");
spawnSleep("proof-b");

const before = readProcessRegistry().children?.length ?? 0;
if (before !== 2) {
  console.error("failed to register sleep children");
  process.exit(1);
}

process.env.AIEOS360_CX01_I01R9_STOP_TIMEOUT_MS = "5000";
const timeout = resolveStopTimeoutMs();
const outcome = await stopRegisteredProcessGroups();

if (!outcome.ok || outcome.rejected.length > 0) {
  console.error(JSON.stringify(outcome, null, 2));
  process.exit(1);
}
if (!outcome.stopTiming?.within_deadline) {
  console.error("stop timing not within deadline", outcome.stopTiming);
  process.exit(1);
}
if (outcome.stopTiming.stop_elapsed_ms > timeout) {
  console.error("elapsed exceeded configured timeout");
  process.exit(1);
}

console.log(
  JSON.stringify({
    ok: true,
    shared_stop_deadline_ms: timeout,
    stop_timing: outcome.stopTiming,
  }),
);
