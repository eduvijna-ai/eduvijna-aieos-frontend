import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertManagedStatusReport,
  CANONICAL_HTTP_ROLES,
  parseStatusStdout,
} from "./managed_status_gate.mjs";
import {
  buildRehearsalReport,
  finalizeExitCode,
  resolveCleanupPlan,
  shouldNeverStopForeignStack,
} from "./rehearse_report.mjs";

const selfDir = dirname(fileURLToPath(import.meta.url));

function healthyStatusSample() {
  const health_checks = [];
  for (const role of CANONICAL_HTTP_ROLES) {
    health_checks.push({ role, surface: "backend", ok: true });
    health_checks.push({ role, surface: "frontend", ok: true });
  }
  return {
    operator_status: { phase: "running" },
    live_process_count: 8,
    missing_live_roles: [],
    registry_truth: "live_registry_matches_expected",
    readiness_ok: true,
    health_checks,
  };
}

assertManagedStatusReport(healthyStatusSample());

assert.throws(() => assertManagedStatusReport({ ...healthyStatusSample(), health_checks: [] }));
assert.throws(() =>
  assertManagedStatusReport({
    ...healthyStatusSample(),
    health_checks: healthyStatusSample().health_checks.slice(0, 7),
  }),
);
assert.throws(() =>
  assertManagedStatusReport({
    ...healthyStatusSample(),
    health_checks: [
      ...healthyStatusSample().health_checks,
      { role: "teacher", surface: "backend", ok: true },
    ],
  }),
);
assert.throws(() =>
  assertManagedStatusReport({
    ...healthyStatusSample(),
    health_checks: healthyStatusSample().health_checks.map((entry, index) =>
      index === 0 ? { ...entry, ok: false } : entry,
    ),
  }),
);

const noisyStdout = `> noise\n${JSON.stringify(healthyStatusSample())}`;
assert.deepEqual(parseStatusStdout(noisyStdout).readiness_ok, true);

assert.deepEqual(
  resolveCleanupPlan({ ownedStartAttempted: false, ownedLifecycle: false }),
  { runPartialCleanup: false, runOwnedStop: false },
);
assert.equal(shouldNeverStopForeignStack({ ownedStartAttempted: false, ownedLifecycle: false }), true);
assert.deepEqual(
  resolveCleanupPlan({ ownedStartAttempted: true, ownedLifecycle: false }),
  { runPartialCleanup: true, runOwnedStop: false },
);
assert.deepEqual(
  resolveCleanupPlan({ ownedStartAttempted: true, ownedLifecycle: true }),
  { runPartialCleanup: false, runOwnedStop: true },
);

assert.equal(finalizeExitCode(0, 0), 0);
assert.equal(finalizeExitCode(0, 2), 2);
assert.equal(finalizeExitCode(1, 2), 1);

const failReport = buildRehearsalReport({
  outcome: "fail",
  steps: [{ step: "e2e", status: "fail" }],
  startedAt: Date.now() - 100,
  failureReason: "e2e nonzero",
  exitCode: 1,
});
assert.equal(failReport.outcome, "fail");
assert.equal(failReport.exit_code, 1);
assert.equal(failReport.failure_reason, "e2e nonzero");

const rehearse = readFileSync(join(selfDir, "rehearse.mjs"), "utf8");
assert.ok(!rehearse.includes("STATUS_SKIP_LIVE"));
assert.ok(rehearse.includes("buildRehearsalReport"));
const catchBlock = rehearse.slice(
  rehearse.indexOf("} catch"),
  rehearse.indexOf("} finally"),
);
assert.ok(!catchBlock.includes("writeReport("));

console.log("rehearse_lifecycle.selftest: pass");
