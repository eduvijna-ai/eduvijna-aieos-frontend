import assert from "node:assert/strict";
import { runRehearsalOrchestration } from "./rehearse_orchestration.mjs";

function makeRunner(script) {
  const calls = [];
  return {
    calls,
    runManagedCommand(command, args, extraEnv = {}) {
      calls.push({ command, args, extraEnv });
      return script(command, args, calls);
    },
  };
}

function baseDeps(overrides = {}) {
  const runner = overrides.runner ?? makeRunner(() => 0);
  return {
    env: { AIEOS_BACKEND_ROOT: "/tmp/backend" },
    runPinGuard: () => {},
    assertManagedStartRegistryGate: () => ({ ok: true }),
    runManagedCommand: runner.runManagedCommand,
    assertManagedStackReady: () => {},
    runPartialCleanup: (steps) => {
      steps.push({ step: "showcase_stop_after_partial_start", status: "pass" });
      return 0;
    },
    runOwnedStop: (steps) => {
      steps.push({ step: "showcase_stop", status: "pass" });
      return 0;
    },
    verifyOwnedRegistryClear: () => ({ ok: true, liveCount: 0 }),
    ...overrides,
  };
}

// 1) unsafe registry → abort without stop
{
  const runner = makeRunner(() => {
    throw new Error("stop must not run");
  });
  const result = runRehearsalOrchestration(
    baseDeps({
      runner,
      assertManagedStartRegistryGate: () => ({
        ok: false,
        code: "live_foreign",
        reason: "foreign stack",
      }),
    }),
  );
  assert.equal(result.exitCode, 1);
  assert.equal(result.ownedStartAttempted, false);
  assert.ok(
    !result.steps.some((step) => step.step.includes("stop")),
    "foreign registry must not invoke stop",
  );
}

// 2) owned success path
{
  const runner = makeRunner((command, args) => {
    if (command === "pnpm" && args[0] === "test:e2e:aieos360-cx01-i07") {
      return 0;
    }
    return 0;
  });
  const result = runRehearsalOrchestration(baseDeps({ runner }));
  assert.equal(result.exitCode, 0);
  assert.ok(result.steps.some((step) => step.step === "managed_status_gate"));
  assert.ok(result.steps.some((step) => step.step === "showcase_stop"));
}

// 3) e2e nonzero → fail + stop
{
  const runner = makeRunner((command, args) => {
    if (command === "pnpm" && args[0] === "test:e2e:aieos360-cx01-i07") {
      return 1;
    }
    return 0;
  });
  const result = runRehearsalOrchestration(baseDeps({ runner }));
  assert.equal(result.exitCode, 1);
  assert.match(result.failureReason ?? "", /nonzero/);
  assert.ok(result.steps.some((step) => step.step === "showcase_stop"));
}

// 4) owned stop fails → nonzero
{
  const runner = makeRunner(() => 0);
  const result = runRehearsalOrchestration(
    baseDeps({
      runner,
      runOwnedStop: (steps) => {
        steps.push({ step: "showcase_stop", status: "fail" });
        return 2;
      },
    }),
  );
  assert.equal(result.exitCode, 2);
  assert.match(result.failureReason ?? "", /showcase_stop failed/);
}

// 5) partial start failure → partial cleanup + registry verify fail-closed
{
  const runner = makeRunner((command, args) => {
    if (command === "pnpm" && args[0] === "showcase:aieos360:start") {
      return 1;
    }
    return 0;
  });
  const result = runRehearsalOrchestration(
    baseDeps({
      runner,
      verifyOwnedRegistryClear: () => ({ ok: false, liveCount: 2 }),
    }),
  );
  assert.equal(result.exitCode, 1);
  assert.equal(result.ownedStartAttempted, true);
  assert.equal(result.ownedLifecycle, false);
  assert.ok(
    result.steps.some(
      (step) => step.step === "verify_registry_clear_after_partial_start",
    ),
  );
}

// 6) owned stop callback throws → fail-closed + scrubbed step error
{
  const runner = makeRunner(() => 0);
  const result = runRehearsalOrchestration(
    baseDeps({
      runner,
      runOwnedStop: () => {
        throw new Error("dev-student-a must not leak");
      },
    }),
  );
  assert.equal(result.exitCode, 1);
  assert.match(result.failureReason ?? "", /showcase_stop threw/);
  assert.ok(result.steps.some((step) => step.step === "showcase_stop"));
}

// 7) residual processes after owned stop → nonzero
{
  const runner = makeRunner(() => 0);
  const result = runRehearsalOrchestration(
    baseDeps({
      runner,
      verifyOwnedRegistryClear: () => ({ ok: false, liveCount: 1 }),
    }),
  );
  assert.equal(result.exitCode, 1);
  assert.ok(
    result.steps.some(
      (step) => step.step === "verify_registry_clear_after_owned_stop",
    ),
  );
}

console.log("rehearse_orchestration.selftest: pass");
