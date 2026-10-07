#!/usr/bin/env node
/** Mandatory local semantic selftest: PGID-aware stop classification + shared deadline. */
import { spawn } from "node:child_process";
import {
  appendProcessChild,
  classifyRegistryEntry,
  isPidAlive,
  isProcessGroupAlive,
  linuxProcessStartTime,
  readProcessRegistry,
  resolveStopTimeoutMs,
  stopRegisteredProcessGroups,
  writeProcessRegistry,
} from "./process_group.mjs";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function killProcessGroup(pgid) {
  try {
    process.kill(-pgid, "SIGKILL");
  } catch {
    try {
      process.kill(pgid, "SIGKILL");
    } catch {
      /* gone */
    }
  }
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
  return { pid, pgid: pid, startTime };
}

async function testLiveVerifiedGroups() {
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
    throw new Error(`live verified stop failed: ${JSON.stringify(outcome)}`);
  }
  if (!outcome.stopTiming?.within_deadline) {
    throw new Error("stop timing not within deadline");
  }
  if (outcome.stopTiming.stop_elapsed_ms > timeout) {
    throw new Error("elapsed exceeded configured timeout");
  }
  if ((readProcessRegistry().children?.length ?? 0) !== 0) {
    throw new Error("registry should be empty after successful stop");
  }
  return { shared_stop_deadline_ms: timeout, stop_timing: outcome.stopTiming };
}

async function testAlreadyDeadCleanGroup() {
  writeProcessRegistry({ children: [] });
  const brief = spawn("sleep", ["60"], { detached: true, stdio: "ignore" });
  brief.unref();
  const pid = brief.pid;
  const pgid = pid;
  const startTime = linuxProcessStartTime(pid);
  killProcessGroup(pgid);
  await sleep(300);
  if (isPidAlive(pid) || isProcessGroupAlive(pgid)) {
    throw new Error("fixture: expected leader and process group gone");
  }
  appendProcessChild({
    role: "dead-before-stop",
    script: "sleep",
    pid,
    pgid,
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
    throw new Error(`already_stopped stop failed: ${JSON.stringify(outcome)}`);
  }
  if ((outcome.already_stopped?.length ?? 0) !== 1) {
    throw new Error("expected one already_stopped entry");
  }
  if ((readProcessRegistry().children?.length ?? 0) !== 0) {
    throw new Error("already_stopped entry should be removed from registry");
  }
}

async function testBirthIdentityMismatch() {
  writeProcessRegistry({ children: [] });
  const { pid, pgid, startTime } = spawnSleep("mismatch-victim");
  writeProcessRegistry({
    children: [
      {
        role: "mismatch-victim",
        script: "sleep",
        pid,
        pgid,
        startTime: String(Number(startTime) + 999_999),
        port: null,
        spawned_at: new Date().toISOString(),
      },
    ],
  });
  const classified = classifyRegistryEntry(readProcessRegistry().children[0]);
  if (classified.classification !== "rejected_unsafe") {
    throw new Error(`expected rejected_unsafe, got ${classified.classification}`);
  }
  const outcome = await stopRegisteredProcessGroups();
  if (outcome.ok) {
    throw new Error("expected stop failure on identity mismatch");
  }
  if (outcome.rejected.length !== 1) {
    throw new Error(`expected one rejection, got ${outcome.rejected.length}`);
  }
  if (!isPidAlive(pid)) {
    throw new Error("mismatch process group must not have been signaled");
  }
  if ((readProcessRegistry().children?.length ?? 0) !== 1) {
    throw new Error("unresolved registry evidence must remain after mismatch");
  }
  killProcessGroup(pgid);
  await sleep(300);
  writeProcessRegistry({ children: [] });
}

async function testLeaderDeadProcessGroupStillAlive() {
  writeProcessRegistry({ children: [] });
  const leader = spawn(
    "bash",
    ["-c", "sleep 300 & exit 0"],
    { detached: true, stdio: "ignore" },
  );
  leader.unref();
  const pid = leader.pid;
  const pgid = pid;
  const startTime = linuxProcessStartTime(pid);
  await sleep(500);
  if (isPidAlive(pid)) {
    killProcessGroup(pgid);
    throw new Error("fixture: leader should have exited");
  }
  if (!isProcessGroupAlive(pgid)) {
    throw new Error("fixture: process group should still be alive with child sleep");
  }
  appendProcessChild({
    role: "orphan-pg",
    script: "bash",
    pid,
    pgid,
    startTime,
    port: null,
    spawned_at: new Date().toISOString(),
  });
  const classified = classifyRegistryEntry(readProcessRegistry().children[0]);
  if (classified.classification !== "rejected_unsafe") {
    killProcessGroup(pgid);
    throw new Error(
      `expected rejected_unsafe (leader dead, pg alive), got ${classified.classification}`,
    );
  }
  const outcome = await stopRegisteredProcessGroups();
  if (outcome.ok) {
    killProcessGroup(pgid);
    throw new Error("expected fail-closed stop when leader dead but pg alive");
  }
  if ((readProcessRegistry().children?.length ?? 0) !== 1) {
    killProcessGroup(pgid);
    throw new Error("registry evidence must be preserved for unverifiable live pg");
  }
  killProcessGroup(pgid);
  await sleep(300);
  writeProcessRegistry({ children: [] });
}

const sharedDeadline = await testLiveVerifiedGroups();
await testAlreadyDeadCleanGroup();
await testBirthIdentityMismatch();
await testLeaderDeadProcessGroupStillAlive();

console.log(
  JSON.stringify({
    ok: true,
    cases: [
      "live_verified",
      "already_stopped",
      "rejected_unsafe_identity_mismatch",
      "rejected_unsafe_leader_dead_pg_alive",
    ],
    shared_stop_deadline_ms: sharedDeadline.shared_stop_deadline_ms,
    stop_timing: sharedDeadline.stop_timing,
  }),
);
