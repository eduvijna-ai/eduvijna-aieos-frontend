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

export async function stopRegisteredProcessGroups({
  termTimeoutMs = Number(
    process.env.AIEOS360_CX01_I01R9_STOP_TERM_TIMEOUT_MS || "15000",
  ),
} = {}) {
  const registry = readProcessRegistry();
  const children = registry.children ?? [];
  const rejected = [];

  for (const entry of children) {
    const identity = verifyRegistryEntry(entry);
    if (!identity.ok) {
      rejected.push({ ...entry, reason: identity.reason });
      continue;
    }
    try {
      process.kill(-entry.pgid, "SIGTERM");
    } catch (error) {
      rejected.push({ ...entry, reason: String(error) });
      continue;
    }
    const exited = await waitForPidExit(entry.pid, termTimeoutMs);
    if (!exited && isPidAlive(entry.pid)) {
      try {
        process.kill(-entry.pgid, "SIGKILL");
      } catch (error) {
        rejected.push({ ...entry, reason: `SIGKILL failed: ${error}` });
        continue;
      }
      await waitForPidExit(entry.pid, 5_000);
    }
  }

  writeProcessRegistry({ ...registry, children: [] });
  return { stopped: children.length, rejected };
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
