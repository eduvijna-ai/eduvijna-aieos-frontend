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

export function findLivePidsWithOwnershipToken(token) {
  if (!token) {
    return [];
  }
  const found = [];
  if (process.platform === "linux") {
    for (const name of readdirSync("/proc")) {
      if (!/^\d+$/.test(name)) {
        continue;
      }
      const pid = Number(name);
      if (isPidAlive(pid) && ownershipTokenInProcess(pid, token)) {
        found.push(pid);
      }
    }
    return found;
  }
  if (process.platform === "darwin" || process.platform === "win32") {
    const pairs =
      process.platform === "darwin"
        ? fetchDarwinParentPairs()
        : fetchWindowsParentPairs();
    if (!pairs) {
      return [];
    }
    for (const { pid } of pairs) {
      if (isPidAlive(pid) && ownershipTokenInProcess(pid, token)) {
        found.push(pid);
      }
    }
    return found;
  }
  return [];
}

export function planRegistryEntryShutdown(entry) {
  if (!entry?.pid) {
    return {
      entry,
      rejected: true,
      reason: "missing pid",
      targets: [],
      root_alive: false,
      root_already_dead: false,
    };
  }
  const rootAlive = isPidAlive(entry.pid);
  if (rootAlive) {
    const rootCheck = verifyRegistryEntryOwnership(entry.pid, entry);
    if (!rootCheck.ok) {
      return {
        entry,
        rejected: true,
        reason: rootCheck.reason,
        targets: [],
        root_alive: true,
        root_already_dead: false,
      };
    }
    return {
      entry,
      rejected: false,
      targets: collectOwnedStopTargets(entry),
      root_alive: true,
      root_already_dead: false,
    };
  }
  const tokenTargets = findLivePidsWithOwnershipToken(entry.ownershipToken);
  const orphanDescendants = listOwnedDescendantPids(entry.pid).filter(
    (pid) =>
      isPidAlive(pid) &&
      (ownershipTokenInProcess(pid, entry.ownershipToken) ||
        isDescendantOf(pid, entry.pid)),
  );
  const targets = [...new Set([...tokenTargets, ...orphanDescendants])];
  return {
    entry,
    rejected: false,
    targets,
    root_alive: false,
    root_already_dead: true,
  };
}

function maySignalPid(pid, plan) {
  const { entry } = plan;
  if (!isPidAlive(pid)) {
    return false;
  }
  if (pid === entry.pid) {
    return plan.root_alive && verifyRegistryEntryOwnership(pid, entry).ok;
  }
  return (
    ownershipTokenInProcess(pid, entry.ownershipToken) ||
    isDescendantOf(pid, entry.pid)
  );
}

function mayForceKillPid(pid, plan) {
  const { entry } = plan;
  if (!isPidAlive(pid)) {
    return false;
  }
  if (pid === entry.pid) {
    return plan.root_alive && verifyRegistryEntryOwnership(pid, entry).ok;
  }
  return (
    ownershipTokenInProcess(pid, entry.ownershipToken) ||
    isDescendantOf(pid, entry.pid)
  );
}

function isPidAllowedForPlan(pid, plan) {
  const { entry } = plan;
  if (!isPidAlive(pid)) {
    return false;
  }
  if (pid === entry.pid) {
    if (!plan.root_alive) {
      return false;
    }
    return verifyRegistryEntryOwnership(pid, entry).ok;
  }
  return (
    ownershipTokenInProcess(pid, entry.ownershipToken) ||
    isDescendantOf(pid, entry.pid)
  );
}

export function collectVerifiedTargetsForPlan(plan) {
  if (plan.rejected) {
    return [];
  }
  const refreshed = planRegistryEntryShutdown(plan.entry);
  const targets = new Set();
  if (!refreshed.rejected) {
    for (const pid of refreshed.targets) {
      targets.add(pid);
    }
    plan.root_alive = refreshed.root_alive;
    plan.root_already_dead = refreshed.root_already_dead;
  }
  for (const pid of findLivePidsWithOwnershipToken(plan.entry.ownershipToken)) {
    if (isPidAlive(pid)) {
      targets.add(pid);
    }
  }
  return [...targets].filter((pid) => isPidAllowedForPlan(pid, plan));
}

function collectAllVerifiedTargets(activePlans) {
  const targets = new Set();
  for (const plan of activePlans) {
    for (const pid of collectVerifiedTargetsForPlan(plan)) {
      targets.add(pid);
    }
  }
  return [...targets];
}

/**
 * Signal all verified registry trees, then poll once for grace and once for kill.
 */
export async function executeStopWideShutdown(plans, options = {}) {
  const treeGraceMs = options.treeGraceMs ?? options.termTimeoutMs ?? 15_000;
  const treeKillMs = options.treeKillMs ?? options.killTimeoutMs ?? 25_000;
  const startedAt = Date.now();

  const activePlans = plans.filter((plan) => !plan.rejected);
  const signaled = [];
  const signaledByPlan = new Map();
  const observedByPlan = new Map();

  function observePlanTarget(plan, pid) {
    if (!pid) {
      return;
    }
    let set = observedByPlan.get(plan);
    if (!set) {
      set = new Set();
      observedByPlan.set(plan, set);
    }
    set.add(pid);
  }

  for (const plan of activePlans) {
    for (const pid of plan.targets) {
      observePlanTarget(plan, pid);
    }
    const planSignaled = [];
    for (const pid of plan.targets) {
      if (!maySignalPid(pid, plan)) {
        continue;
      }
      signalTerminate(pid);
      planSignaled.push(pid);
      signaled.push(pid);
      observePlanTarget(plan, pid);
    }
    signaledByPlan.set(plan, planSignaled);
  }

  const uniqueSignaled = [...new Set(signaled)];
  await waitForAllPidsExit(uniqueSignaled, treeGraceMs);

  const preKillTargets = collectAllVerifiedTargets(activePlans);
  for (const plan of activePlans) {
    for (const pid of collectVerifiedTargetsForPlan(plan)) {
      observePlanTarget(plan, pid);
    }
  }
  const killCandidates = preKillTargets.filter((pid) => isPidAlive(pid));
  for (const pid of killCandidates) {
    const plan = activePlans.find((candidate) =>
      collectVerifiedTargetsForPlan(candidate).includes(pid),
    );
    if (!plan || !mayForceKillPid(pid, plan)) {
      continue;
    }
    observePlanTarget(plan, pid);
    signalForceKill(pid);
  }

  await waitForAllPidsExit(
    killCandidates.filter((pid) => isPidAlive(pid)),
    treeKillMs,
  );

  const postKillTargets = collectAllVerifiedTargets(activePlans);
  for (const plan of activePlans) {
    for (const pid of collectVerifiedTargetsForPlan(plan)) {
      observePlanTarget(plan, pid);
    }
  }
  const survivorSet = new Set(postKillTargets.filter((pid) => isPidAlive(pid)));

  const perEntry = plans.map((plan) => {
    if (plan.rejected) {
      return {
        entry: plan.entry,
        rejected: true,
        reason: plan.reason,
        targets: [],
        signaled: [],
        survivors: [],
        descendant_exit: [],
        ok: false,
      };
    }
    const finalTargets = collectVerifiedTargetsForPlan(plan);
    plan.targets = finalTargets;
    const planSurvivors = finalTargets.filter((pid) => survivorSet.has(pid));
    const observedTargets = [
      ...(observedByPlan.get(plan) ?? new Set()),
      ...finalTargets,
    ];
    const descendantExit = [...new Set(observedTargets)].map((pid) => ({
      pid,
      exited: !isPidAlive(pid),
      is_root: pid === plan.entry.pid,
    }));
    return {
      entry: plan.entry,
      rejected: false,
      targets: plan.targets,
      signaled: signaledByPlan.get(plan) ?? [],
      survivors: planSurvivors,
      descendant_exit: descendantExit,
      root_already_dead: plan.root_already_dead,
      ok: planSurvivors.length === 0,
    };
  });

  return {
    perEntry,
    stop_wide_elapsed_ms: Date.now() - startedAt,
    tree_grace_ms: treeGraceMs,
    tree_kill_ms: treeKillMs,
    all_survivors: [...survivorSet],
  };
}

export async function terminateOwnedProcessTree(entry, options = {}) {
  const plan = planRegistryEntryShutdown(entry);
  if (plan.rejected) {
    return {
      ok: false,
      reason: plan.reason,
      rejected: true,
      targets: [],
      signaled: [],
      survivors: [],
      descendant_exit: [],
    };
  }
  const batch = await executeStopWideShutdown([plan], options);
  const outcome = batch.perEntry[0];
  return {
    ok: outcome.ok,
    rejected: false,
    targets: outcome.targets,
    signaled: outcome.signaled,
    survivors: outcome.survivors,
    descendant_exit: outcome.descendant_exit,
    tree_grace_ms: batch.tree_grace_ms,
    tree_kill_ms: batch.tree_kill_ms,
    stop_wide_elapsed_ms: batch.stop_wide_elapsed_ms,
  };
}
