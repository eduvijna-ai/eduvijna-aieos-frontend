/**
 * Sanitized local I07 rehearsal report builder and exit/cleanup helpers.
 */

export const EXPECTED_MANAGED_PROCESS_COUNT = 8;

export function resolveCleanupPlan({ ownedLifecycle, ownedStartAttempted }) {
  return {
    runPartialCleanup: Boolean(ownedStartAttempted && !ownedLifecycle),
    runOwnedStop: Boolean(ownedLifecycle),
  };
}

/** Never stop when rehearsal never attempted an owned start. */
export function shouldNeverStopForeignStack({
  ownedStartAttempted,
  ownedLifecycle,
}) {
  return !ownedStartAttempted && !ownedLifecycle;
}

export function finalizeExitCode(primaryExit, stopExit) {
  const primary = primaryExit ?? 1;
  if (stopExit == null || stopExit === 0) {
    return primary;
  }
  return primary === 0 ? stopExit : primary;
}

export function buildRehearsalReport({
  outcome,
  steps,
  startedAt,
  failureReason,
  exitCode,
}) {
  const base = {
    package: "AIEOS360-CX01-I07",
    outcome,
    exit_code: exitCode,
    failure_reason: failureReason ?? null,
    duration_ms: Date.now() - startedAt,
    steps,
    composition: "local_managed_i01r9_stack",
    classification: "NON_PRODUCTION",
    real_ai_live_generation: "PENDING",
  };
  if (outcome === "pass") {
    return {
      ...base,
      scenario_id: "AIEOS360-CX-SCENARIO-01",
      substrate: "aieos360-cx01-i01-showcase-rehearsal",
    };
  }
  return base;
}
