import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertManagedStatusReport,
  CANONICAL_HTTP_ROLES,
} from "./managed_status_gate.mjs";
import {
  assertSanitizedRehearsalReportPayload,
  sanitizeReportString,
  scanReportTextForLeaks,
} from "./rehearse_report_sanitize.mjs";
import { buildRehearsalReport } from "./rehearse_report.mjs";
import { EXPECTED_MANAGED_PROCESS_ROLES } from "./managed_registry_roles.mjs";

const selfDir = dirname(fileURLToPath(import.meta.url));

function healthyStatusSample() {
  const role_urls = {
    teacher: {
      frontend: "http://127.0.0.1:5291/teacher-os/today",
      backend: "http://127.0.0.1:8020",
    },
    student: {
      frontend: "http://127.0.0.1:5292/student-os/home",
      backend: "http://127.0.0.1:8021",
    },
    principal: {
      frontend: "http://127.0.0.1:5293/principal-os",
      backend: "http://127.0.0.1:8022",
    },
    parent: {
      frontend: "http://127.0.0.1:5294/parent-os",
      backend: "http://127.0.0.1:8023",
    },
  };
  const live_processes = [
    { role: "teacher-backend", pid: 101, port: 8020 },
    { role: "teacher_frontend", pid: 102, port: 5291 },
    { role: "student-backend", pid: 103, port: 8021 },
    { role: "student_frontend", pid: 104, port: 5292 },
    { role: "principal-backend", pid: 105, port: 8022 },
    { role: "principal_frontend", pid: 106, port: 5293 },
    { role: "parent-backend", pid: 107, port: 8023 },
    { role: "parent_frontend", pid: 108, port: 5294 },
  ];
  const health_checks = [];
  for (const role of CANONICAL_HTTP_ROLES) {
    health_checks.push({ role, surface: "backend", ok: true });
    health_checks.push({ role, surface: "frontend", ok: true });
  }
  return {
    operator_status: { phase: "running", role_urls },
    live_process_count: 8,
    missing_live_roles: [],
    registry_truth: "live_registry_matches_expected",
    readiness_ok: true,
    health_checks,
    live_processes,
  };
}

assertManagedStatusReport(healthyStatusSample());

const swappedPort = healthyStatusSample();
swappedPort.live_processes[0].port = 9999;
assert.throws(() => assertManagedStatusReport(swappedPort));

const missingRole = healthyStatusSample();
missingRole.live_processes = missingRole.live_processes.filter(
  (entry) => entry.role !== "parent_frontend",
);
missingRole.live_process_count = 7;
assert.throws(() => assertManagedStatusReport(missingRole));

const sanitized = sanitizeReportString(
  "failed: postgresql://aieos_runtime:aieos_test@127.0.0.1:5432/aieos token aieos360-cx01-i01-showcase-teacher",
);
assert.ok(sanitized.includes("[REDACTED]"));
assert.equal(scanReportTextForLeaks(sanitized).length, 0);

const failReport = buildRehearsalReport({
  outcome: "fail",
  steps: [{ step: "e2e", status: "fail" }],
  startedAt: Date.now() - 50,
  failureReason:
    "postgresql://aieos_runtime:secret@127.0.0.1:5432/aieos bearer aieos360-cx01-i01-showcase-teacher",
  exitCode: 1,
});
assertSanitizedRehearsalReportPayload(failReport);

const rehearse = readFileSync(join(selfDir, "rehearse.mjs"), "utf8");
assert.ok(rehearse.includes("runRehearsalOrchestration"));
assert.equal(EXPECTED_MANAGED_PROCESS_ROLES.length, 8);

console.log("rehearse_lifecycle.selftest: pass");
