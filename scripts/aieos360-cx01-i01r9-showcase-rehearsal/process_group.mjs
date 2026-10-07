import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname } from "node:path";
import { processesPath, statusPath } from "./paths.mjs";

const REGISTRY_OWNER = "aieos360-cx01-i01r9-showcase";

export function readProcessRegistry() {
  try {
    return JSON.parse(readFileSync(processesPath, "utf8"));
  } catch {
    return { owner: REGISTRY_OWNER, children: [] };
  }
}

export function writeProcessRegistry(registry) {
  mkdirSync(dirname(processesPath), { recursive: true });
  writeFileSync(
    processesPath,
    JSON.stringify(
      {
        owner: REGISTRY_OWNER,
        registry_version: 1,
        ...registry,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
}

export function writeOperatorStatus(status) {
  mkdirSync(dirname(statusPath), { recursive: true });
  writeFileSync(statusPath, JSON.stringify(status, null, 2) + "\n", "utf8");
}

export function linuxProcessStartTime(pid) {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    const close = stat.lastIndexOf(")");
    if (close === -1) {
      return null;
    }
    const fields = stat.slice(close + 2).split(" ");
    const startTime = fields[19];
    return startTime ?? null;
  } catch {
    return null;
  }
}

export function isPidAlive(pid) {
  if (!pid || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Process-group liveness via signal 0 to the negative PGID. */
export function isProcessGroupAlive(pgid) {
  if (!pgid || pgid <= 0) {
    return false;
  }
  try {
    process.kill(-pgid, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") {
      return false;
    }
    return true;
  }
}

/**
 * PRE-SIGNAL classification for governed registry entries.
 * - live_verified: leader alive + matching birth identity
 * - already_stopped: leader dead and process group gone
 * - rejected_unsafe: incomplete, identity mismatch, or leader dead while PG still exists
 */
export function classifyRegistryEntry(entry) {
  if (!entry?.pid || !entry?.pgid || !entry?.startTime) {
    return {
      classification: "rejected_unsafe",
      reason: "incomplete registry entry",
    };
  }

  const leaderAlive = isPidAlive(entry.pid);
  const pgAlive = isProcessGroupAlive(entry.pgid);

  if (!leaderAlive && !pgAlive) {
    return { classification: "already_stopped" };
  }

  if (!leaderAlive && pgAlive) {
    return {
      classification: "rejected_unsafe",
      reason: "leader not alive while process group still exists",
    };
  }

  const currentStart = linuxProcessStartTime(entry.pid);
  if (currentStart !== entry.startTime) {
    return {
      classification: "rejected_unsafe",
      reason: `birth identity mismatch (expected ${entry.startTime}, got ${currentStart})`,
    };
  }

  return { classification: "live_verified" };
}

/** True only when the entry is a live_verified governed process group leader. */
export function verifyRegistryEntry(entry) {
  const classified = classifyRegistryEntry(entry);
  if (classified.classification === "live_verified") {
    return { ok: true };
  }
  if (classified.classification === "already_stopped") {
    return { ok: false, reason: "pid not alive" };
  }
  return { ok: false, reason: classified.reason };
}

export function appendProcessChild(entry) {
  const registry = readProcessRegistry();
  const children = [...(registry.children ?? []), entry];
  writeProcessRegistry({ ...registry, children });
  return entry;
}

export function spawnDetachedProcessGroup({
  command,
  args,
  env,
  cwd,
  role,
  script,
  port,
}) {
  const child = spawn(command, args, {
    cwd,
    env,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  const pid = child.pid;
  if (!pid) {
    throw new Error(`failed to spawn ${role}: no pid`);
  }
  const startTime = linuxProcessStartTime(pid);
  if (!startTime) {
    throw new Error(`failed to read birth identity for ${role} pid=${pid}`);
  }
  const entry = {
    role,
    script,
    pid,
    pgid: pid,
    startTime,
    port: port ?? null,
    spawned_at: new Date().toISOString(),
  };
  appendProcessChild(entry);
  return entry;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForPidExit(pid, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!isPidAlive(pid)) {
      return true;
    }
    await sleep(200);
  }
  return !isPidAlive(pid);
}

function remainingMs(deadlineAt) {
  return Math.max(0, deadlineAt - Date.now());
}

async function waitForProcessGroupsExit(entries, deadlineAt) {
  while (remainingMs(deadlineAt) > 0) {
    const alive = entries.filter((entry) => isProcessGroupAlive(entry.pgid));
    if (alive.length === 0) {
      return true;
    }
    await sleep(Math.min(200, remainingMs(deadlineAt)));
  }
  return entries.every((entry) => !isProcessGroupAlive(entry.pgid));
}

const DEFAULT_KILL_RESERVE_MS = 1000;

export function assertValidStopTimeoutMs(stopTimeoutMs) {
  if (!Number.isFinite(stopTimeoutMs) || stopTimeoutMs <= 0) {
    throw new Error(`invalid stop timeout: ${stopTimeoutMs}`);
  }
  return stopTimeoutMs;
}

/** Nonzero budget reserved inside the overall stop deadline for SIGKILL + final wait. */
export function resolveKillReserveMs(stopTimeoutMs) {
  assertValidStopTimeoutMs(stopTimeoutMs);
  return Math.min(
    DEFAULT_KILL_RESERVE_MS,
    Math.max(1, Math.floor(stopTimeoutMs / 2)),
  );
}

export function resolveStopTimeoutMs() {
  const raw = Number(
    process.env.AIEOS360_CX01_I01R9_STOP_TIMEOUT_MS ??
      process.env.AIEOS360_CX01_I01_SHOWCASE_STOP_TIMEOUT_MS ??
      "30000",
  );
  return assertValidStopTimeoutMs(raw);
}

/** Bounded SIGTERM grace strictly below overall stop timeout (leaves SIGKILL budget). */
export function resolveTermGraceMs(stopTimeoutMs) {
  assertValidStopTimeoutMs(stopTimeoutMs);
  const killReserveMs = resolveKillReserveMs(stopTimeoutMs);
  const maxTermGraceMs = stopTimeoutMs - killReserveMs;
  if (maxTermGraceMs <= 0) {
    throw new Error(
      `stop timeout too small to reserve SIGKILL budget: ${stopTimeoutMs}`,
    );
  }

  const configured =
    process.env.AIEOS360_CX01_I01R9_STOP_TERM_GRACE_MS ??
    process.env.AIEOS360_CX01_I01_SHOWCASE_STOP_TERM_GRACE_MS;
  let requestedMs;
  if (configured !== undefined && configured !== "") {
    requestedMs = Number(configured);
    if (!Number.isFinite(requestedMs) || requestedMs < 0) {
      throw new Error(`invalid TERM grace: ${configured}`);
    }
  } else {
    requestedMs = Math.floor(stopTimeoutMs / 2);
  }
  return Math.min(requestedMs, maxTermGraceMs);
}

function registryEntriesToRetain(children, alreadyStopped, rejected, survivors, liveVerified) {
  const removePids = new Set(alreadyStopped.map((entry) => entry.pid));
  for (const entry of liveVerified) {
    if (rejected.some((r) => r.pid === entry.pid)) {
      continue;
    }
    if (survivors.some((s) => s.pid === entry.pid)) {
      continue;
    }
    if (!isProcessGroupAlive(entry.pgid)) {
      removePids.add(entry.pid);
    }
  }
  return children.filter((entry) => !removePids.has(entry.pid));
}

/** One shared absolute deadline for the entire managed stack stop operation. */
export async function stopRegisteredProcessGroups() {
  const stopTimeoutMs = resolveStopTimeoutMs();
  const termGraceMs = resolveTermGraceMs(stopTimeoutMs);
  const stopStartedAt = Date.now();
  const stopDeadlineAt = stopStartedAt + stopTimeoutMs;
  const termGraceDeadlineAt = Math.min(
    stopDeadlineAt,
    stopStartedAt + termGraceMs,
  );

  const registry = readProcessRegistry();
  const children = registry.children ?? [];
  const rejected = [];
  const alreadyStopped = [];
  const liveVerified = [];

  for (const entry of children) {
    const classified = classifyRegistryEntry(entry);
    if (classified.classification === "already_stopped") {
      alreadyStopped.push({ ...entry, classification: "already_stopped" });
    } else if (classified.classification === "live_verified") {
      liveVerified.push(entry);
    } else {
      rejected.push({
        ...entry,
        phase: "pre_signal",
        classification: "rejected_unsafe",
        reason: classified.reason,
      });
    }
  }

  const verifiedAtPreSignal = [...liveVerified];

  for (const entry of liveVerified) {
    try {
      process.kill(-entry.pgid, "SIGTERM");
    } catch (error) {
      rejected.push({
        ...entry,
        phase: "sigterm",
        classification: "rejected_unsafe",
        reason: String(error),
      });
    }
  }

  const termPhaseStarted = Date.now();
  const termTargets = verifiedAtPreSignal.filter(
    (entry) => !rejected.some((r) => r.pid === entry.pid),
  );
  await waitForProcessGroupsExit(termTargets, termGraceDeadlineAt);
  const termPhaseEnded = Date.now();

  for (const entry of termTargets) {
    if (remainingMs(stopDeadlineAt) <= 0) {
      break;
    }
    if (!isProcessGroupAlive(entry.pgid)) {
      continue;
    }
    try {
      process.kill(-entry.pgid, "SIGKILL");
    } catch (error) {
      rejected.push({
        ...entry,
        phase: "sigkill",
        classification: "rejected_unsafe",
        reason: String(error),
      });
    }
  }

  await waitForProcessGroupsExit(
    termTargets.filter((entry) => !rejected.some((r) => r.pid === entry.pid)),
    stopDeadlineAt,
  );

  const survivors = termTargets.filter(
    (entry) =>
      !rejected.some((r) => r.pid === entry.pid) &&
      isProcessGroupAlive(entry.pgid),
  );
  for (const entry of survivors) {
    rejected.push({
      ...entry,
      phase: "survivor",
      classification: "rejected_unsafe",
      reason: "survived stop-wide deadline",
    });
  }

  const remainingChildren = registryEntriesToRetain(
    children,
    alreadyStopped,
    rejected,
    survivors,
    verifiedAtPreSignal,
  );
  writeProcessRegistry({ ...registry, children: remainingChildren });

  const stopElapsedMs = Date.now() - stopStartedAt;
  const killReserveMs = resolveKillReserveMs(stopTimeoutMs);
  const stopTiming = {
    stop_timeout_ms: stopTimeoutMs,
    term_grace_ms: termGraceMs,
    kill_reserve_ms: killReserveMs,
    stop_deadline_at_ms: stopDeadlineAt,
    term_grace_deadline_at_ms: termGraceDeadlineAt,
    stop_elapsed_ms: stopElapsedMs,
    term_phase_ms: termPhaseEnded - termPhaseStarted,
    kill_phase_ms: Date.now() - termPhaseEnded,
    rejected_count: rejected.length,
    already_stopped_count: alreadyStopped.length,
    live_verified_count: verifiedAtPreSignal.length,
    survivor_count: survivors.length,
    unresolved_registry_count: remainingChildren.length,
    within_deadline: stopElapsedMs <= stopTimeoutMs && survivors.length === 0,
  };

  const ok = rejected.length === 0 && survivors.length === 0;
  return {
    stopped: children.length,
    already_stopped: alreadyStopped,
    rejected,
    stopTiming,
    ok,
    unresolved_registry: remainingChildren,
  };
}

export async function waitForHttpOk(url, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
      if (response.ok) {
        return true;
      }
    } catch {
      /* retry */
    }
    await sleep(500);
  }
  throw new Error(`service not ready: ${url}`);
}
