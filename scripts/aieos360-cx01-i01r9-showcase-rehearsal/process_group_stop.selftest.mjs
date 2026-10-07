#!/usr/bin/env node
/** Mandatory local semantic selftest: PGID-aware stop classification + shared deadline. */
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import {
  appendProcessChild,
  assertManagedStartRegistryGate,
  classifyRegistryEntry,
  emptyProcessRegistry,
  isPidAlive,
  isProcessGroupAlive,
  linuxProcessStartTime,
  readProcessRegistry,
  REGISTRY_OWNER,
  REGISTRY_VERSION,
  resolveKillReserveMs,
  resolveStopTimeoutMs,
  resolveTermGraceMs,
  stopRegisteredProcessGroups,
  writeProcessRegistry,
} from "./process_group.mjs";
import { processesPath } from "./paths.mjs";

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

function assertThrows(fn, includes) {
  try {
    fn();
    throw new Error(`expected throw containing "${includes}"`);
  } catch (error) {
    if (!String(error).includes(includes)) {
      throw error;
    }
  }
}

function testProcessRegistryContracts() {
  const hadRegistry = existsSync(processesPath);
  const priorBytes = hadRegistry ? readFileSync(processesPath) : null;

  try {
    mkdirSync(dirname(processesPath), { recursive: true });
    if (hadRegistry) {
      unlinkSync(processesPath);
    }
    const absent = readProcessRegistry();
    const canonical = emptyProcessRegistry();
    if (
      absent.owner !== canonical.owner ||
      absent.registry_version !== canonical.registry_version ||
      absent.children.length !== 0
    ) {
      throw new Error("absent registry must yield canonical empty document");
    }

    writeFileSync(processesPath, "{not-json\n", "utf8");
    const malformedBytes = readFileSync(processesPath);
    assertThrows(() => readProcessRegistry(), "process registry parse failed");
    if (!readFileSync(processesPath).equals(malformedBytes)) {
      throw new Error("malformed registry file must remain unchanged on read failure");
    }

    const wrongOwner = JSON.stringify({
      owner: "foreign",
      registry_version: 1,
      children: [],
    });
    writeFileSync(processesPath, wrongOwner, "utf8");
    assertThrows(() => readProcessRegistry(), "invalid process registry owner");
    if (readFileSync(processesPath, "utf8") !== wrongOwner) {
      throw new Error("wrong-owner registry must remain unchanged on read failure");
    }

    const wrongVersion = JSON.stringify({
      owner: REGISTRY_OWNER,
      registry_version: 99,
      children: [],
    });
    writeFileSync(processesPath, wrongVersion, "utf8");
    assertThrows(() => readProcessRegistry(), "unsupported process registry version");
    if (readFileSync(processesPath, "utf8") !== wrongVersion) {
      throw new Error("wrong-version registry must remain unchanged on read failure");
    }

    const badChildren = JSON.stringify({
      owner: REGISTRY_OWNER,
      registry_version: REGISTRY_VERSION,
      children: "not-an-array",
    });
    writeFileSync(processesPath, badChildren, "utf8");
    assertThrows(() => readProcessRegistry(), "children must be an array");
    if (readFileSync(processesPath, "utf8") !== badChildren) {
      throw new Error("invalid children shape must remain unchanged on read failure");
    }

    writeProcessRegistry({ children: [] });
    writeProcessRegistry({
      owner: "evil",
      registry_version: 99,
      children: [],
    });
    const written = readProcessRegistry();
    if (written.owner !== REGISTRY_OWNER || written.registry_version !== REGISTRY_VERSION) {
      throw new Error("writer must not persist foreign owner/version");
    }

    const live = spawn("sleep", ["30"], { detached: true, stdio: "ignore" });
    live.unref();
    const livePid = live.pid;
    const liveStart = linuxProcessStartTime(livePid);
    writeProcessRegistry({
      children: [
        {
          role: "gate-live",
          script: "sleep",
          pid: livePid,
          pgid: livePid,
          startTime: liveStart,
          port: null,
          spawned_at: new Date().toISOString(),
        },
      ],
    });
    const runningGate = assertManagedStartRegistryGate();
    if (runningGate.ok || runningGate.code !== "already_running") {
      killProcessGroup(livePid);
      throw new Error("live_verified registry must block managed start");
    }
    killProcessGroup(livePid);

    writeProcessRegistry({
      children: [
        {
          role: "gate-unsafe",
          script: "sleep",
          pid: livePid,
          pgid: livePid + 1,
          startTime: liveStart,
          port: null,
          spawned_at: new Date().toISOString(),
        },
      ],
    });
    const unsafeGate = assertManagedStartRegistryGate();
    if (unsafeGate.ok || unsafeGate.code !== "unsafe_unresolved") {
      throw new Error("rejected_unsafe registry must block managed start");
    }
    writeProcessRegistry({ children: [] });
  } finally {
    if (priorBytes !== null) {
      writeFileSync(processesPath, priorBytes);
    } else if (existsSync(processesPath)) {
      unlinkSync(processesPath);
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

async function testCorruptedPgidRegistryEntry() {
  writeProcessRegistry({ children: [] });
  const groupA = spawn("sleep", ["30"], { detached: true, stdio: "ignore" });
  groupA.unref();
  const groupB = spawn("sleep", ["30"], { detached: true, stdio: "ignore" });
  groupB.unref();
  const pidA = groupA.pid;
  const pidB = groupB.pid;
  const startA = linuxProcessStartTime(pidA);
  writeProcessRegistry({
    children: [
      {
        role: "corrupted-pgid",
        script: "sleep",
        pid: pidA,
        pgid: pidB,
        startTime: startA,
        port: null,
        spawned_at: new Date().toISOString(),
      },
    ],
  });
  const outcome = await stopRegisteredProcessGroups();
  if (outcome.ok) {
    killProcessGroup(pidA);
    killProcessGroup(pidB);
    throw new Error("corrupted pgid entry must fail stop closed");
  }
  if ((readProcessRegistry().children?.length ?? 0) !== 1) {
    killProcessGroup(pidA);
    killProcessGroup(pidB);
    throw new Error("corrupted registry entry must be preserved");
  }
  if (!isProcessGroupAlive(pidB) || !isProcessGroupAlive(pidA)) {
    killProcessGroup(pidA);
    killProcessGroup(pidB);
    throw new Error("corrupted entry must not signal unrelated or true process groups");
  }
  writeProcessRegistry({ children: [] });
  killProcessGroup(pidA);
  killProcessGroup(pidB);
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

function saveEnv(keys) {
  const saved = {};
  for (const key of keys) {
    saved[key] = process.env[key];
  }
  return saved;
}

function restoreEnv(saved) {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function testTermGraceConfiguredCaps() {
  const envKeys = [
    "AIEOS360_CX01_I01R9_STOP_TERM_GRACE_MS",
    "AIEOS360_CX01_I01_SHOWCASE_STOP_TERM_GRACE_MS",
  ];
  const saved = saveEnv(envKeys);
  const stopMs = 5000;
  const reserve = resolveKillReserveMs(stopMs);
  const maxGrace = stopMs - reserve;
  try {
    process.env.AIEOS360_CX01_I01R9_STOP_TERM_GRACE_MS = "100";
    if (resolveTermGraceMs(stopMs) !== 100) {
      throw new Error("TERM grace below cap should be respected");
    }
    process.env.AIEOS360_CX01_I01R9_STOP_TERM_GRACE_MS = String(stopMs);
    if (resolveTermGraceMs(stopMs) !== maxGrace) {
      throw new Error("TERM grace equal to stop timeout must be capped");
    }
    process.env.AIEOS360_CX01_I01R9_STOP_TERM_GRACE_MS = String(stopMs + 10_000);
    if (resolveTermGraceMs(stopMs) !== maxGrace) {
      throw new Error("TERM grace above stop timeout must be capped");
    }
    if (maxGrace >= stopMs) {
      throw new Error("max TERM grace must be strictly below stop timeout");
    }
    try {
      resolveTermGraceMs(-1);
      throw new Error("invalid stop timeout should fail closed");
    } catch (error) {
      if (!String(error).includes("invalid stop timeout")) {
        throw error;
      }
    }
    try {
      process.env.AIEOS360_CX01_I01R9_STOP_TERM_GRACE_MS = "not-a-number";
      resolveTermGraceMs(stopMs);
      throw new Error("invalid configured TERM grace should fail closed");
    } catch (error) {
      if (!String(error).includes("invalid TERM grace")) {
        throw error;
      }
    }
    try {
      process.env.AIEOS360_CX01_I01R9_STOP_TERM_GRACE_MS = "0";
      resolveTermGraceMs(stopMs);
      throw new Error("zero configured TERM grace should fail closed");
    } catch (error) {
      if (!String(error).includes("invalid TERM grace")) {
        throw error;
      }
    }
    try {
      process.env.AIEOS360_CX01_I01R9_STOP_TERM_GRACE_MS = "-1";
      resolveTermGraceMs(stopMs);
      throw new Error("negative configured TERM grace should fail closed");
    } catch (error) {
      if (!String(error).includes("invalid TERM grace")) {
        throw error;
      }
    }
  } finally {
    restoreEnv(saved);
  }
}

async function testTermGraceEqualStopTimeoutStillKills() {
  writeProcessRegistry({ children: [] });
  const child = spawn(
    "bash",
    ["-c", 'trap "" TERM; sleep 300'],
    { detached: true, stdio: "ignore" },
  );
  child.unref();
  const pid = child.pid;
  const pgid = pid;
  const startTime = linuxProcessStartTime(pid);
  appendProcessChild({
    role: "term-ignorer-capped-grace",
    script: "bash",
    pid,
    pgid,
    startTime,
    port: null,
    spawned_at: new Date().toISOString(),
  });
  const envKeys = [
    "AIEOS360_CX01_I01R9_STOP_TIMEOUT_MS",
    "AIEOS360_CX01_I01R9_STOP_TERM_GRACE_MS",
  ];
  const saved = saveEnv(envKeys);
  try {
    process.env.AIEOS360_CX01_I01R9_STOP_TIMEOUT_MS = "4000";
    process.env.AIEOS360_CX01_I01R9_STOP_TERM_GRACE_MS = "4000";
    const outcome = await stopRegisteredProcessGroups();
    if (!outcome.ok) {
      killProcessGroup(pgid);
      throw new Error(`capped grace kill failed: ${JSON.stringify(outcome)}`);
    }
    if (isProcessGroupAlive(pgid)) {
      killProcessGroup(pgid);
      throw new Error("SIGKILL should run when configured TERM grace equals stop timeout");
    }
    if (outcome.stopTiming.term_grace_ms >= 4000) {
      throw new Error("configured TERM grace must be capped below stop timeout");
    }
  } finally {
    restoreEnv(saved);
  }
}

async function testTermGraceReservesSigkillBudget() {
  writeProcessRegistry({ children: [] });
  const child = spawn(
    "bash",
    ["-c", 'trap "" TERM; sleep 300'],
    { detached: true, stdio: "ignore" },
  );
  child.unref();
  const pid = child.pid;
  const pgid = pid;
  const startTime = linuxProcessStartTime(pid);
  appendProcessChild({
    role: "term-ignorer",
    script: "bash",
    pid,
    pgid,
    startTime,
    port: null,
    spawned_at: new Date().toISOString(),
  });
  process.env.AIEOS360_CX01_I01R9_STOP_TIMEOUT_MS = "4000";
  process.env.AIEOS360_CX01_I01R9_STOP_TERM_GRACE_MS = "800";
  const outcome = await stopRegisteredProcessGroups();
  if (!outcome.ok) {
    killProcessGroup(pgid);
    throw new Error(`term grace kill failed: ${JSON.stringify(outcome)}`);
  }
  if (isProcessGroupAlive(pgid)) {
    killProcessGroup(pgid);
    throw new Error("SIGKILL should have removed TERM-ignoring process group");
  }
  if (outcome.stopTiming.term_phase_ms > 1500) {
    throw new Error("TERM phase should not consume entire stop deadline");
  }
  if (outcome.stopTiming.stop_elapsed_ms >= 4000) {
    throw new Error("overall stop deadline exceeded before SIGKILL could run");
  }
  if (outcome.stopTiming.term_grace_ms !== 800) {
    throw new Error(`unexpected term_grace_ms: ${outcome.stopTiming.term_grace_ms}`);
  }
  if (!outcome.stopTiming.within_deadline) {
    throw new Error("stop should complete within shared deadline");
  }
}

testProcessRegistryContracts();
testTermGraceConfiguredCaps();
await testCorruptedPgidRegistryEntry();
const sharedDeadline = await testLiveVerifiedGroups();
await testAlreadyDeadCleanGroup();
await testBirthIdentityMismatch();
await testLeaderDeadProcessGroupStillAlive();
await testTermGraceReservesSigkillBudget();
await testTermGraceEqualStopTimeoutStillKills();

console.log(
  JSON.stringify({
    ok: true,
    cases: [
      "registry_absent_canonical_empty",
      "registry_malformed_fail_closed",
      "registry_owner_version_shape_fail_closed",
      "registry_writer_owner_version_authoritative",
      "managed_start_gate_live_and_unsafe",
      "rejected_unsafe_corrupted_pgid",
      "live_verified",
      "already_stopped",
      "rejected_unsafe_identity_mismatch",
      "rejected_unsafe_leader_dead_pg_alive",
      "term_grace_then_sigkill_within_overall_deadline",
      "term_grace_configured_caps",
      "term_grace_equal_stop_timeout_still_kills",
    ],
    shared_stop_deadline_ms: sharedDeadline.shared_stop_deadline_ms,
    stop_timing: sharedDeadline.stop_timing,
  }),
);
