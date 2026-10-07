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

export function verifyRegistryEntry(entry) {
  if (!entry?.pid || !entry?.pgid || !entry?.startTime) {
    return { ok: false, reason: "incomplete registry entry" };
  }
  if (!isPidAlive(entry.pid)) {
    return { ok: false, reason: "pid not alive" };
  }
  const currentStart = linuxProcessStartTime(entry.pid);
  if (currentStart !== entry.startTime) {
    return {
      ok: false,
      reason: `birth identity mismatch (expected ${entry.startTime}, got ${currentStart})`,
    };
  }
  return { ok: true };
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

async function waitForEntriesExit(entries, deadlineAt) {
  while (remainingMs(deadlineAt) > 0) {
    const alive = entries.filter((entry) => isPidAlive(entry.pid));
    if (alive.length === 0) {
      return true;
    }
    await sleep(Math.min(200, remainingMs(deadlineAt)));
  }
  return entries.every((entry) => !isPidAlive(entry.pid));
}

export function resolveStopTimeoutMs() {
  return Number(
    process.env.AIEOS360_CX01_I01R9_STOP_TIMEOUT_MS ??
      process.env.AIEOS360_CX01_I01_SHOWCASE_STOP_TIMEOUT_MS ??
      "30000",
  );
}

/** One shared absolute deadline for the entire managed stack stop operation. */
export async function stopRegisteredProcessGroups() {
  const stopTimeoutMs = resolveStopTimeoutMs();
  const stopStartedAt = Date.now();
  const stopDeadlineAt = stopStartedAt + stopTimeoutMs;

  const registry = readProcessRegistry();
  const children = registry.children ?? [];
  const rejected = [];
  const verified = [];

  for (const entry of children) {
    const identity = verifyRegistryEntry(entry);
    if (!identity.ok) {
      rejected.push({ ...entry, phase: "pre_signal", reason: identity.reason });
    } else {
      verified.push(entry);
    }
  }

  for (const entry of verified) {
    try {
      process.kill(-entry.pgid, "SIGTERM");
    } catch (error) {
      rejected.push({ ...entry, phase: "sigterm", reason: String(error) });
    }
  }

  const termPhaseStarted = Date.now();
  const termTargets = verified.filter(
    (entry) => !rejected.some((r) => r.pid === entry.pid),
  );
  await waitForEntriesExit(termTargets, stopDeadlineAt);
  const termPhaseEnded = Date.now();

  const killTargets = termTargets.filter((entry) => {
    const identity = verifyRegistryEntry(entry);
    return identity.ok && isPidAlive(entry.pid);
  });

  for (const entry of killTargets) {
    if (remainingMs(stopDeadlineAt) <= 0) {
      break;
    }
    const identity = verifyRegistryEntry(entry);
    if (!identity.ok) {
      rejected.push({ ...entry, phase: "pre_kill", reason: identity.reason });
      continue;
    }
    try {
      process.kill(-entry.pgid, "SIGKILL");
    } catch (error) {
      rejected.push({ ...entry, phase: "sigkill", reason: String(error) });
    }
  }

  await waitForEntriesExit(
    termTargets.filter((entry) => !rejected.some((r) => r.pid === entry.pid)),
    stopDeadlineAt,
  );

  const survivors = termTargets.filter((entry) => {
    const identity = verifyRegistryEntry(entry);
    return identity.ok && isPidAlive(entry.pid);
  });
  for (const entry of survivors) {
    rejected.push({
      ...entry,
      phase: "survivor",
      reason: "survived stop-wide deadline",
    });
  }

  writeProcessRegistry({ ...registry, children: [] });

  const stopElapsedMs = Date.now() - stopStartedAt;
  const stopTiming = {
    stop_timeout_ms: stopTimeoutMs,
    stop_deadline_at_ms: stopDeadlineAt,
    stop_elapsed_ms: stopElapsedMs,
    term_phase_ms: termPhaseEnded - termPhaseStarted,
    kill_phase_ms: Date.now() - termPhaseEnded,
    rejected_count: rejected.length,
    survivor_count: survivors.length,
    within_deadline: stopElapsedMs <= stopTimeoutMs && survivors.length === 0,
  };

  const ok = rejected.length === 0 && survivors.length === 0;
  return { stopped: children.length, rejected, stopTiming, ok };
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
