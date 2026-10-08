import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname } from "node:path";
import { processesPath, statusPath } from "./paths.mjs";

export const REGISTRY_OWNER = "aieos360-cx01-i01r9-showcase";
export const REGISTRY_VERSION = 1;

export function emptyProcessRegistry() {
  return {
    owner: REGISTRY_OWNER,
    registry_version: REGISTRY_VERSION,
    children: [],
  };
}

export function isSafePositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

export function validateRegistryDocument(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid process registry: not an object");
  }
  if (parsed.owner !== REGISTRY_OWNER) {
    throw new Error(`invalid process registry owner: ${parsed.owner}`);
  }
  if (parsed.registry_version !== REGISTRY_VERSION) {
    throw new Error(
      `unsupported process registry version: ${parsed.registry_version}`,
    );
  }
  if (!Array.isArray(parsed.children)) {
    throw new Error("invalid process registry: children must be an array");
  }
  return parsed;
}

export function readProcessRegistry() {
  let raw;
  try {
    raw = readFileSync(processesPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return emptyProcessRegistry();
    }
    throw new Error(`process registry read failed: ${error?.message ?? error}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`process registry parse failed: ${error?.message ?? error}`);
  }
  return validateRegistryDocument(parsed);
}

export function writeProcessRegistry(registry) {
  const children = registry?.children;
  if (!Array.isArray(children)) {
    throw new Error("invalid process registry write: children must be an array");
  }
  mkdirSync(dirname(processesPath), { recursive: true });
  const document = {
    owner: REGISTRY_OWNER,
    registry_version: REGISTRY_VERSION,
    children,
  };
  writeFileSync(
    processesPath,
    JSON.stringify(document, null, 2) + "\n",
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

/** Signal-authority preconditions before any negative-PGID signal eligibility. */
export function signalAuthorityRejectedReason(entry) {
  if (!entry || typeof entry !== "object") {
    return "incomplete registry entry";
  }
  const { pid, pgid, startTime } = entry;
  if (pid === undefined && pgid === undefined && startTime === undefined) {
    return "incomplete registry entry";
  }
  if (!isSafePositiveInteger(pid) || !isSafePositiveInteger(pgid)) {
    return "invalid signal authority pid/pgid";
  }
  if (typeof startTime !== "string" || startTime.length === 0) {
    return "invalid signal authority birth identity";
  }
  if (pgid !== pid) {
    return "pgid must equal detached leader pid";
  }
  return null;
}

/**
 * PRE-SIGNAL classification for governed registry entries.
 * - live_verified: leader alive + matching birth identity
 * - already_stopped: leader dead and process group gone
 * - rejected_unsafe: incomplete, identity mismatch, or leader dead while PG still exists
 */
export function classifyRegistryEntry(entry) {
  const authorityReason = signalAuthorityRejectedReason(entry);
  if (authorityReason) {
    return {
      classification: "rejected_unsafe",
      reason: authorityReason,
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

/**
 * Managed start may proceed only when the registry is empty or all entries are already_stopped.
 * live_verified and rejected_unsafe entries block start (running or unsafe recovery evidence).
 */
export function assertManagedStartRegistryGate(registry = readProcessRegistry()) {
  for (const entry of registry.children ?? []) {
    const classified = classifyRegistryEntry(entry);
    if (classified.classification === "live_verified") {
      return {
        ok: false,
        code: "already_running",
        entry,
        reason: classified.reason,
      };
    }
    if (classified.classification === "rejected_unsafe") {
      return {
        ok: false,
        code: "unsafe_unresolved",
        entry,
        reason: classified.reason,
      };
    }
  }
  return { ok: true };
}

export function appendProcessChild(entry) {
  const registry = readProcessRegistry();
  const children = [...registry.children, entry];
  writeProcessRegistry({ children });
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
    if (!Number.isFinite(requestedMs) || requestedMs <= 0) {
      throw new Error(`invalid TERM grace: ${configured}`);
    }
  } else {
    requestedMs = Math.floor(stopTimeoutMs / 2);
  }
  return Math.min(requestedMs, maxTermGraceMs);
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
  const indexedChildren = children.map((entry, index) => ({ index, entry }));
  const rejected = [];
  const rejectedIndices = new Set();
  const alreadyStopped = [];
  const alreadyStoppedIndices = [];
  const liveVerifiedIndexed = [];

  const markRejected = (index, entry, phase, reason) => {
    if (rejectedIndices.has(index)) {
      return;
    }
    rejectedIndices.add(index);
    rejected.push({
      ...entry,
      phase,
      classification: "rejected_unsafe",
      reason,
    });
  };

  for (const { index, entry } of indexedChildren) {
    const classified = classifyRegistryEntry(entry);
    if (classified.classification === "already_stopped") {
      alreadyStoppedIndices.push(index);
      alreadyStopped.push({ ...entry, classification: "already_stopped" });
    } else if (classified.classification === "live_verified") {
      liveVerifiedIndexed.push({ index, entry });
    } else {
      markRejected(index, entry, "pre_signal", classified.reason);
    }
  }

  const verifiedAtPreSignal = [...liveVerifiedIndexed];

  for (const { index, entry } of liveVerifiedIndexed) {
    if (rejectedIndices.has(index)) {
      continue;
    }
    try {
      process.kill(-entry.pgid, "SIGTERM");
    } catch (error) {
      markRejected(index, entry, "sigterm", String(error));
    }
  }

  const termPhaseStarted = Date.now();
  const termTargets = verifiedAtPreSignal.filter(
    ({ index }) => !rejectedIndices.has(index),
  );
  await waitForProcessGroupsExit(
    termTargets.map(({ entry }) => entry),
    termGraceDeadlineAt,
  );
  const termPhaseEnded = Date.now();

  for (const { index, entry } of termTargets) {
    if (remainingMs(stopDeadlineAt) <= 0) {
      break;
    }
    if (rejectedIndices.has(index)) {
      continue;
    }
    if (!isProcessGroupAlive(entry.pgid)) {
      continue;
    }
    try {
      process.kill(-entry.pgid, "SIGKILL");
    } catch (error) {
      markRejected(index, entry, "sigkill", String(error));
    }
  }

  await waitForProcessGroupsExit(
    termTargets
      .filter(({ index }) => !rejectedIndices.has(index))
      .map(({ entry }) => entry),
    stopDeadlineAt,
  );

  const survivors = termTargets.filter(
    ({ index, entry }) =>
      !rejectedIndices.has(index) && isProcessGroupAlive(entry.pgid),
  );
  for (const { index, entry } of survivors) {
    markRejected(index, entry, "survivor", "survived stop-wide deadline");
  }

  const removeIndices = new Set(alreadyStoppedIndices);
  for (const { index, entry } of verifiedAtPreSignal) {
    if (rejectedIndices.has(index)) {
      continue;
    }
    if (!isProcessGroupAlive(entry.pgid)) {
      removeIndices.add(index);
    }
  }

  const remainingChildren = children.filter((_, index) => !removeIndices.has(index));
  writeProcessRegistry({ children: remainingChildren });

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
