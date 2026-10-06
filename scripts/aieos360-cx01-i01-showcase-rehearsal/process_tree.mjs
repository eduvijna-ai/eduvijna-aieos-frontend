import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { isPidAlive } from "./process_registry.mjs";
import {
  ownershipTokenInProcess,
  verifyRegistryEntryOwnership,
} from "./process_identity.mjs";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function buildParentMapFromPairs(pairs) {
  const byParent = new Map();
  for (const { pid, ppid } of pairs) {
    if (!byParent.has(ppid)) {
      byParent.set(ppid, []);
    }
    byParent.get(ppid).push(pid);
  }
  return byParent;
}

function listDescendantsFromMap(rootPid, byParent) {
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

function fetchWindowsParentPairs() {
  const ps = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId | ConvertTo-Json -Compress",
    ],
    { encoding: "utf8" },
  );
  if (ps.status !== 0) {
    return null;
  }
  try {
    const raw = JSON.parse(ps.stdout || "[]");
    const list = Array.isArray(raw) ? raw : [raw];
    return list
      .filter((row) => row?.ProcessId)
      .map((row) => ({
        pid: Number(row.ProcessId),
        ppid: Number(row.ParentProcessId),
      }));
  } catch {
    return null;
  }
}

function fetchDarwinParentPairs() {
  const ps = spawnSync("ps", ["-axo", "pid=,ppid="], { encoding: "utf8" });
  if (ps.status !== 0) {
    return null;
  }
  const pairs = [];
  for (const line of (ps.stdout || "").split("\n")) {
    const match = line.trim().match(/^(\d+)\s+(\d+)/);
    if (!match) {
      continue;
    }
    pairs.push({ pid: Number(match[1]), ppid: Number(match[2]) });
  }
  return pairs;
}

export function getParentMapForPlatform() {
  if (process.platform === "linux") {
    return buildLinuxParentMap();
  }
  if (process.platform === "win32") {
    const pairs = fetchWindowsParentPairs();
    return pairs ? buildParentMapFromPairs(pairs) : null;
  }
  if (process.platform === "darwin") {
    const pairs = fetchDarwinParentPairs();
    return pairs ? buildParentMapFromPairs(pairs) : null;
  }
  return null;
}

function parentOf(pid, map) {
  for (const [ppid, children] of map.entries()) {
    if (children.includes(pid)) {
      return ppid;
    }
  }
  return null;
}

export function isDescendantOf(pid, ancestorPid, parentMap = null) {
  if (!pid || !ancestorPid) {
    return false;
  }
  if (pid === ancestorPid) {
    return true;
  }
  if (process.platform === "linux") {
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
  const map = parentMap ?? getParentMapForPlatform();
  if (!map) {
    return false;
  }
  let current = pid;
  const seen = new Set();
  while (current > 0 && !seen.has(current)) {
    seen.add(current);
    if (current === ancestorPid) {
      return true;
    }
    const ppid = parentOf(current, map);
    if (ppid === null) {
      return false;
    }
    current = ppid;
  }
  return false;
}

export function listOwnedDescendantPids(rootPid) {
  const map = getParentMapForPlatform();
  if (!map) {
    return [];
  }
  return listDescendantsFromMap(rootPid, map);
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

export async function waitForAllPidsExit(pids, deadlineMs) {
  const end = Date.now() + deadlineMs;
  const unique = [...new Set(pids)];
  while (Date.now() < end) {
    const alive = unique.filter((pid) => isPidAlive(pid));
    if (alive.length === 0) {
      return { allExited: true, alive: [] };
    }
    await sleep(200);
  }
  return {
    allExited: false,
    alive: unique.filter((pid) => isPidAlive(pid)),
  };
}

function signalTerminate(pid) {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(pid), "/T"], { encoding: "utf8" });
    return;
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    /* ignore */
  }
}

function signalForceKill(pid) {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
      encoding: "utf8",
    });
    return;
  }
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    /* ignore */
  }
}

export async function terminateOwnedProcessTree(entry, options = {}) {
  const treeGraceMs = options.treeGraceMs ?? options.termTimeoutMs ?? 15_000;
  const treeKillMs = options.treeKillMs ?? options.killTimeoutMs ?? 25_000;

  const rootCheck = verifyRegistryEntryOwnership(entry.pid, entry);
  if (!rootCheck.ok) {
    return {
      ok: false,
      reason: rootCheck.reason,
      rejected: true,
      targets: [],
      signaled: [],
      survivors: [],
      descendant_exit: [],
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
    signalTerminate(pid);
    signaled.push(pid);
  }

  await waitForAllPidsExit(signaled, treeGraceMs);

  const stillAlive = targets.filter((pid) => isPidAlive(pid));
  for (const pid of stillAlive) {
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
    signalForceKill(pid);
  }

  const afterKill = await waitForAllPidsExit(stillAlive, treeKillMs);
  const survivors = afterKill.alive;

  const descendantExit = targets.map((pid) => ({
    pid,
    exited: !isPidAlive(pid),
    is_root: pid === entry.pid,
  }));

  return {
    ok: survivors.length === 0,
    targets,
    signaled,
    survivors,
    descendant_exit: descendantExit,
    tree_grace_ms: treeGraceMs,
    tree_kill_ms: treeKillMs,
  };
}
