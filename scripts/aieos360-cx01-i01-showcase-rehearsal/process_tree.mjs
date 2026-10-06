import { readdirSync, readFileSync } from "node:fs";
import { isPidAlive } from "./process_registry.mjs";
import {
  ownershipTokenInProcess,
  verifyRegistryEntryOwnership,
  waitForPidExit,
} from "./process_identity.mjs";

function readLinuxPpid(pid) {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    const close = stat.lastIndexOf(")");
    if (close === -1) {
      return null;
    }
    return Number(stat.slice(close + 2).split(" ")[1]);
  } catch {
    return null;
  }
}

function buildLinuxParentMap() {
  const byParent = new Map();
  for (const entry of readdirSync("/proc")) {
    if (!/^\d+$/.test(entry)) {
      continue;
    }
    const pid = Number(entry);
    const ppid = readLinuxPpid(pid);
    if (ppid === null) {
      continue;
    }
    if (!byParent.has(ppid)) {
      byParent.set(ppid, []);
    }
    byParent.get(ppid).push(pid);
  }
  return byParent;
}

export function isDescendantOf(pid, ancestorPid) {
  if (!pid || !ancestorPid || pid === ancestorPid) {
    return pid === ancestorPid;
  }
  if (process.platform !== "linux") {
    return false;
  }
  let current = pid;
  const seen = new Set();
  while (current > 0 && !seen.has(current)) {
    seen.add(current);
    if (current === ancestorPid) {
      return true;
    }
    const ppid = readLinuxPpid(current);
    if (ppid === null) {
      return false;
    }
    current = ppid;
  }
  return false;
}

export function listOwnedDescendantPids(rootPid) {
  if (process.platform !== "linux") {
    return [];
  }
  const byParent = buildLinuxParentMap();
  const descendants = [];
  const queue = [...(byParent.get(rootPid) ?? [])];
  const seen = new Set([rootPid]);
  while (queue.length > 0) {
    const pid = queue.shift();
    if (seen.has(pid)) {
      continue;
    }
    seen.add(pid);
    descendants.push(pid);
    for (const child of byParent.get(pid) ?? []) {
      queue.push(child);
    }
  }
  return descendants;
}

export function collectOwnedStopTargets(entry) {
  const root = entry.pid;
  const descendants = listOwnedDescendantPids(root);
  const targets = [root];
  for (const pid of descendants) {
    if (
      ownershipTokenInProcess(pid, entry.ownershipToken) ||
      isDescendantOf(pid, root)
    ) {
      targets.push(pid);
    }
  }
  return [...new Set(targets)];
}

export async function terminateOwnedProcessTree(entry, options = {}) {
  const termTimeoutMs = options.termTimeoutMs ?? 15_000;
  const killTimeoutMs = options.killTimeoutMs ?? 25_000;

  const rootCheck = verifyRegistryEntryOwnership(entry.pid, entry);
  if (!rootCheck.ok) {
    return {
      ok: false,
      reason: rootCheck.reason,
      rejected: true,
      targets: [],
      survivors: [],
    };
  }

  const targets = collectOwnedStopTargets(entry);
  const signaled = [];

  for (const pid of targets) {
    if (!isPidAlive(pid)) {
      continue;
    }
    if (pid !== entry.pid) {
      const allowed =
        ownershipTokenInProcess(pid, entry.ownershipToken) ||
        isDescendantOf(pid, entry.pid);
      if (!allowed) {
        continue;
      }
    }
    try {
      process.kill(pid, "SIGTERM");
      signaled.push(pid);
    } catch {
      /* ignore */
    }
  }

  for (const pid of signaled) {
    await waitForPidExit(pid, termTimeoutMs);
  }

  const survivors = [];
  for (const pid of targets) {
    if (!isPidAlive(pid)) {
      continue;
    }
    if (pid === entry.pid) {
      const preKill = verifyRegistryEntryOwnership(pid, entry);
      if (!preKill.ok) {
        continue;
      }
    } else if (
      !ownershipTokenInProcess(pid, entry.ownershipToken) &&
      !isDescendantOf(pid, entry.pid)
    ) {
      continue;
    }
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      survivors.push(pid);
      continue;
    }
    const exited = await waitForPidExit(pid, killTimeoutMs);
    if (!exited && isPidAlive(pid)) {
      survivors.push(pid);
    }
  }

  return {
    ok: survivors.length === 0,
    targets,
    signaled,
    survivors,
  };
}
