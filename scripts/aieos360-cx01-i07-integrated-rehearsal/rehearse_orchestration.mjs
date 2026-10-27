import { resolveCleanupPlan, finalizeExitCode } from "./rehearse_report.mjs";

/**
 * Injectable rehearsal orchestration (used by rehearse.mjs and bounded selftests).
 */
export function runRehearsalOrchestration(deps) {
  const {
    env,
    runPinGuard,
    assertManagedStartRegistryGate,
    runManagedCommand,
    assertManagedStackReady,
    runPartialCleanup,
    runOwnedStop,
    verifyOwnedRegistryClear,
  } = deps;

  const steps = [];
  const started = Date.now();
  let exitCode = 1;
  let failureReason = null;
  let ownedLifecycle = false;
  let ownedStartAttempted = false;

  try {
    if (!env.AIEOS_BACKEND_ROOT) {
      throw new Error("AIEOS_BACKEND_ROOT is required for local integrated rehearsal");
    }

    runPinGuard();
    steps.push({ step: "pin_guard", status: "pass" });

    const gate = assertManagedStartRegistryGate();
    if (!gate.ok) {
      throw new Error(
        `CX01-I07 rehearse blocked — managed showcase registry: ${gate.code} ${gate.reason ?? ""}`,
      );
    }
    steps.push({ step: "registry_gate", status: "pass" });

    exitCode = runManagedCommand("pnpm", ["showcase:aieos360:reset"]);
    steps.push({ step: "showcase_reset", status: exitCode === 0 ? "pass" : "fail" });
    if (exitCode !== 0) {
      throw new Error("showcase reset failed");
    }

    ownedStartAttempted = true;
    exitCode = runManagedCommand("pnpm", ["showcase:aieos360:start"]);
    steps.push({ step: "showcase_start", status: exitCode === 0 ? "pass" : "fail" });
    if (exitCode !== 0) {
      throw new Error("showcase start failed");
    }
    ownedLifecycle = true;

    assertManagedStackReady();
    steps.push({ step: "managed_status_gate", status: "pass" });

    exitCode = runManagedCommand("pnpm", ["test:e2e:aieos360-cx01-i07"], {
      AIEOS360_CX01_I07_REHEARSE_MANAGED_STACK: "1",
      AIEOS360_CX01_I07_E2E_SKIP_BOOTSTRAP: "1",
    });
    steps.push({
      step: "integrated_e2e_guard_managed_stack",
      status: exitCode === 0 ? "pass" : "fail",
    });
    if (exitCode !== 0) {
      failureReason = "integrated_e2e_guard_managed_stack exited nonzero";
    }
  } catch (error) {
    failureReason = failureReason ?? String(error);
    exitCode = 1;
  }

  const cleanupPlan = resolveCleanupPlan({
    ownedLifecycle,
    ownedStartAttempted,
  });
  let stopExit = null;

  if (cleanupPlan.runPartialCleanup) {
    stopExit = runPartialCleanup(steps);
    exitCode = finalizeExitCode(exitCode, stopExit);
    if (stopExit !== 0) {
      failureReason =
        failureReason ?? "showcase_stop_after_partial_start failed";
    } else if (verifyOwnedRegistryClear) {
      const residual = verifyOwnedRegistryClear();
      steps.push({
        step: "verify_registry_clear_after_partial_start",
        status: residual.ok ? "pass" : "fail",
      });
      if (!residual.ok) {
        failureReason =
          failureReason ?? `residual owned processes after partial cleanup: ${residual.liveCount}`;
        exitCode = finalizeExitCode(exitCode, 1);
      }
    }
  }
  if (cleanupPlan.runOwnedStop) {
    stopExit = runOwnedStop(steps);
    steps.push({ step: "showcase_stop", status: stopExit === 0 ? "pass" : "fail" });
    exitCode = finalizeExitCode(exitCode, stopExit);
    if (stopExit !== 0) {
      failureReason = failureReason ?? "showcase_stop failed";
    }
  }

  return {
    exitCode,
    failureReason,
    steps,
    started,
    ownedLifecycle,
    ownedStartAttempted,
  };
}
