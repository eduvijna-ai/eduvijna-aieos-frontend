#!/usr/bin/env node
/** Focused selftest: registry classification + shared stop-wide deadline. */
import { spawn } from "node:child_process";
import {
  appendProcessChild,
  classifyRegistryEntry,
  isPidAlive,
  linuxProcessStartTime,
  readProcessRegistry,
  resolveStopTimeoutMs,
  stopRegisteredProcessGroups,
  writeProcessRegistry,
} from "./process_group.mjs";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  return { pid, startTime };
}

async function testAlreadyStoppedDeadPid() {
  writeProcessRegistry({ children: [] });
  const brief = spawn("sleep", ["60"], { detached: true, stdio: "ignore" });
  brief.unref();
  const pid = brief.pid;
  const startTime = linuxProcessStartTime(pid);
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    process.kill(pid, "SIGKILL");
  }
  await sleep(200);
  appendProcessChild({
    role: "dead-before-stop",
    script: "sleep",
    pid,
    pgid: pid,
    startTime,
    port: null,
    spawned_at: new Date().toISOString(),
  });
  const classified = classifyRegistryEntry(readProcessRegistry().children[0]);
  if (classified.classification !== "already_stopped") {
    throw new Error(`expected already_stopped, got ${classified.classification}`);
  }
  const outcome = await stopRegisteredProcessGroups();
  if (!outcome.ok || outcome.rejected.length > 0) {
    throw new Error(`dead pid stop failed: ${JSON.stringify(outcome)}`);
  }
  if ((outcome.already_stopped?.length ?? 0) !== 1) {
    throw new Error("expected one already_stopped entry");
  }
}

async function testOwnedLiveStopped() {
  writeProcessRegistry({ children: [] });
  spawnSleep("proof-a");
  spawnSleep("proof-b");
  if ((readProcessRegistry().children?.length ?? 0) !== 2) {
    throw new Error("failed to register sleep children");
  }
  process.env.AIEOS360_CX01_I01R9_STOP_TIMEOUT_MS = "5000";
  const timeout = resolveStopTimeoutMs();
  const outcome = await stopRegisteredProcessGroups();
  if (!outcome.ok || outcome.rejected.length > 0) {
    throw new Error(`owned live stop failed: ${JSON.stringify(outcome)}`);
  }
  if (!outcome.stopTiming?.within_deadline) {
    throw new Error("stop timing not within deadline");
  }
  if (outcome.stopTiming.stop_elapsed_ms > timeout) {
    throw new Error("elapsed exceeded configured timeout");
  }
  return { shared_stop_deadline_ms: timeout, stop_timing: outcome.stopTiming };
}

async function testIdentityMismatchFailClosed() {
  writeProcessRegistry({ children: [] });
  const { pid, startTime } = spawnSleep("mismatch-victim");
  writeProcessRegistry({
    children: [
      {
        role: "mismatch-victim",
        script: "sleep",
        pid,
        pgid: pid,
        startTime: String(Number(startTime) + 999_999),
        port: null,
        spawned_at: new Date().toISOString(),
      },
    ],
  });
  const classified = classifyRegistryEntry(readProcessRegistry().children[0]);
  if (classified.classification !== "unsafe_identity_mismatch") {
    throw new Error(`expected unsafe_identity_mismatch, got ${classified.classification}`);
  }
  const outcome = await stopRegisteredProcessGroups();
  if (outcome.ok) {
    throw new Error("expected stop failure on identity mismatch");
  }
  if (outcome.rejected.length !== 1) {
    throw new Error(`expected one rejection, got ${outcome.rejected.length}`);
  }
  if (!isPidAlive(pid)) {
    throw new Error("mismatch pid should not have been signaled");
  }
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* already gone */
    }
  }
  await sleep(300);
}

await testAlreadyStoppedDeadPid();
const sharedDeadline = await testOwnedLiveStopped();
await testIdentityMismatchFailClosed();

console.log(
  JSON.stringify({
    ok: true,
    cases: ["already_stopped", "owned_live", "unsafe_identity_mismatch"],
    shared_stop_deadline_ms: sharedDeadline.shared_stop_deadline_ms,
    stop_timing: sharedDeadline.stop_timing,
  }),
);
