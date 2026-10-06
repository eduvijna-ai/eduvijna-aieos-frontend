#!/usr/bin/env node
/**
 * Shared canonical shutdown for stop.mjs, interactive start, and proofs.
 */
import { CX01_SHOWCASE_CONTAINER } from "./constants.mjs";
import { removeOwnedContainer } from "./docker_ownership.mjs";
import { terminateOwnedProcessTree } from "./process_tree.mjs";
import {
  isPidAlive,
  readProcessRegistry,
  writeOperatorStatus,
  writeProcessRegistry,
} from "./process_registry.mjs";

export async function executeCanonicalShutdown(options = {}) {
  const expectContainer =
    options.expectContainer ??
    process.env.AIEOS360_CX01_I01_SHOWCASE_STOP_EXPECT_CONTAINER !== "0";
  const treeGraceMs = Number(
    options.treeGraceMs ||
      process.env.AIEOS360_CX01_I01_SHOWCASE_STOP_TREE_GRACE_MS ||
      "15000",
  );
  const treeKillMs = Number(
    options.treeKillMs ||
      process.env.AIEOS360_CX01_I01_SHOWCASE_STOP_TREE_KILL_MS ||
      "25000",
  );

  const registry = readProcessRegistry();
  const signaled = [];
  const rejected = [];
  const survivors = [];
  const failed = [];
  const treeTargets = [];
  const descendantExitRecords = [];

  for (const entry of registry.children ?? []) {
    if (!entry?.pid) {
      continue;
    }
    if (!isPidAlive(entry.pid)) {
      signaled.push({ ...entry, already_dead: true });
      continue;
    }
    const outcome = await terminateOwnedProcessTree(entry, {
      treeGraceMs,
      treeKillMs,
    });
    if (outcome.rejected) {
      rejected.push({ ...entry, reason: outcome.reason });
      continue;
    }
    treeTargets.push(
      ...outcome.targets.map((pid) => ({ pid, role: entry.role })),
    );
    descendantExitRecords.push({
      role: entry.role,
      root_pid: entry.pid,
      descendant_exit: outcome.descendant_exit,
    });
    signaled.push({ ...entry, tree_signaled: outcome.signaled });
    if (!outcome.ok) {
      for (const pid of outcome.survivors) {
        survivors.push({ ...entry, pid, survivor_pid: pid });
        failed.push({
          ...entry,
          pid,
          error: "owned process tree survivor after shared grace/kill",
        });
      }
    }
  }

  let containerRemoved = false;
  let containerRemoveError = null;
  let containerIdentity = null;
  if (expectContainer) {
    const removal = removeOwnedContainer(CX01_SHOWCASE_CONTAINER);
    if (removal.removed) {
      containerRemoved = true;
      containerIdentity = { containerId: removal.containerId };
    } else if (removal.missing) {
      containerRemoved = false;
    } else if (removal.inspection_error) {
      containerRemoveError = removal.error;
    } else if (removal.error) {
      containerRemoveError = removal.error;
    }
  }

  const phase =
    failed.length > 0 || survivors.length > 0 || containerRemoveError
      ? "stop_failed"
      : "stopped";

  const status = {
    phase,
    classification: "NON_PRODUCTION",
    stopped_at: new Date().toISOString(),
    container_removed: containerRemoved,
    container_identity: containerIdentity,
    signaled_processes: signaled.map(
      ({ pid, role, script, already_dead, tree_signaled }) => ({
        pid,
        role,
        script,
        already_dead: Boolean(already_dead),
        tree_signaled,
      }),
    ),
    tree_targets: treeTargets,
    descendant_exit_records: descendantExitRecords,
    rejected_registry_entries: rejected,
    survivor_processes: survivors.map(({ pid, role, script, survivor_pid }) => ({
      pid: survivor_pid ?? pid,
      role,
      script,
    })),
    failed_processes: failed,
    container_remove_error: containerRemoveError,
    tree_grace_ms: treeGraceMs,
    tree_kill_ms: treeKillMs,
  };

  writeOperatorStatus(status);

  if (phase === "stopped") {
    writeProcessRegistry({ children: [] });
  } else {
    const recoverable = survivors
      .filter((entry) => isPidAlive(entry.survivor_pid ?? entry.pid))
      .concat(
        failed
          .filter((item) => isPidAlive(item.pid))
          .map((item) => ({ ...item, stop_failed: true })),
      );
    writeProcessRegistry({
      children: recoverable,
      last_stop_failed_at: new Date().toISOString(),
    });
  }

  return {
    phase,
    status,
    containerRemoved,
    containerRemoveError,
    rejected,
    survivors,
    failed,
  };
}
