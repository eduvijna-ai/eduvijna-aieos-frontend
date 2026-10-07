#!/usr/bin/env node
/**
 * Shared canonical shutdown for stop.mjs, interactive start, and proofs.
 */
import { CX01_SHOWCASE_CONTAINER } from "./constants.mjs";
import { removeOwnedContainer } from "./docker_ownership.mjs";
import {
  executeStopWideShutdown,
  planRegistryEntryShutdown,
} from "./process_tree.mjs";
import {
  buildSurvivorRegistryEntry,
} from "./process_identity.mjs";
import {
  isPidAlive,
  readProcessRegistry,
  writeOperatorStatus,
  writeProcessRegistry,
} from "./process_registry.mjs";

export async function executeCanonicalShutdown(options = {}) {
  const signalProofHarness =
    process.env.AIEOS360_CX01_I01_SHOWCASE_INTERACTIVE_SIGNAL_PROOF === "1";
  const genericHarness =
    process.env.AIEOS360_CX01_I01_SHOWCASE_SIGNAL_PROOF_HARNESS === "1";
  if (
    process.env.AIEOS360_CX01_I01_SHOWCASE_SIMULATE_SHUTDOWN_THROW === "1" &&
    (signalProofHarness || genericHarness)
  ) {
    throw new Error("simulated canonical shutdown throw (harness)");
  }

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
  const simulateStopFailure =
    options.simulateStopFailure === true &&
    (signalProofHarness || genericHarness);

  try {
  const registry = readProcessRegistry();
  const signaled = [];
  const rejected = [];
  const survivors = [];
  const failed = [];
  const treeTargets = [];
  const descendantExitRecords = [];

  const plans = (registry.children ?? [])
    .filter((entry) => entry?.pid)
    .map((entry) => planRegistryEntryShutdown(entry));

  for (const plan of plans) {
    if (plan.rejected) {
      rejected.push({ ...plan.entry, reason: plan.reason });
    } else if (plan.root_already_dead && plan.targets.length === 0) {
      signaled.push({ ...plan.entry, already_dead: true });
    }
  }

  const stopWide = await executeStopWideShutdown(plans, {
    treeGraceMs,
    treeKillMs,
  });

  for (const outcome of stopWide.perEntry) {
    if (outcome.rejected) {
      continue;
    }
    treeTargets.push(
      ...outcome.targets.map((pid) => ({ pid, role: outcome.entry.role })),
    );
    descendantExitRecords.push({
      role: outcome.entry.role,
      root_pid: outcome.entry.pid,
      root_already_dead: Boolean(outcome.root_already_dead),
      descendant_exit: outcome.descendant_exit,
    });
    if (outcome.signaled.length > 0 || outcome.root_already_dead) {
      signaled.push({
        ...outcome.entry,
        already_dead: outcome.root_already_dead && outcome.signaled.length === 0,
        tree_signaled: outcome.signaled,
      });
    }
    if (!outcome.ok) {
      for (const pid of outcome.survivors) {
        survivors.push(buildSurvivorRegistryEntry(outcome.entry, pid));
        failed.push({
          ...outcome.entry,
          pid,
          error: "owned process tree survivor after stop-wide grace/kill",
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

  let phase =
    failed.length > 0 || survivors.length > 0 || containerRemoveError
      ? "stop_failed"
      : "stopped";

  if (simulateStopFailure) {
    phase = "stop_failed";
  }

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
    survivor_processes: survivors.map(({ pid, role, script }) => ({
      pid,
      role,
      script,
    })),
    failed_processes: failed,
    container_remove_error: containerRemoveError,
    stop_wide_grace_ms: treeGraceMs,
    stop_wide_kill_ms: treeKillMs,
    stop_wide_elapsed_ms: stopWide.stop_wide_elapsed_ms,
    tree_grace_ms: treeGraceMs,
    tree_kill_ms: treeKillMs,
  };

  writeOperatorStatus(status);

  if (phase === "stopped") {
    writeProcessRegistry({ children: [] });
  } else {
    const recoverable = survivors
      .filter((entry) => isPidAlive(entry.pid))
      .concat(
        failed
          .filter((item) => isPidAlive(item.pid))
          .map((item) =>
            buildSurvivorRegistryEntry(
              {
                script: item.script,
                role: item.role,
                parentRunId: item.parentRunId,
                ownershipToken: item.ownershipToken,
              },
              item.pid,
            ),
          ),
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
    stopWideElapsedMs: stopWide.stop_wide_elapsed_ms,
  };
  } catch (error) {
    const stoppedAt = new Date().toISOString();
    const status = {
      phase: "stop_failed",
      classification: "NON_PRODUCTION",
      stopped_at: stoppedAt,
      shutdown_error: String(error),
      container_removed: false,
      signaled_processes: [],
      tree_targets: [],
      descendant_exit_records: [],
      rejected_registry_entries: [],
      survivor_processes: [],
      failed_processes: [],
      container_remove_error: null,
    };
    try {
      writeOperatorStatus(status);
    } catch {
      /* persistence must not mask shutdown failure */
    }
    try {
      const registry = readProcessRegistry();
      writeProcessRegistry({
        children: registry.children ?? [],
        last_stop_failed_at: stoppedAt,
      });
    } catch {
      /* ignore */
    }
    return {
      phase: "stop_failed",
      status,
      containerRemoved: false,
      containerRemoveError: null,
      rejected: [],
      survivors: [],
      failed: [],
      stopWideElapsedMs: null,
      shutdownThrew: true,
      error: String(error),
    };
  }
}
