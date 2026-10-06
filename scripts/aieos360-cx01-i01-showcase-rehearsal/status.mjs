#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import {
  dbReportPath,
  fixturePath,
  manifestPath,
  statusPath,
} from "./paths.mjs";
import { runPinGuard } from "./pin_guard.mjs";
import { isPidAlive, readProcessRegistry, waitForHttpOk } from "./process_registry.mjs";
import { verifyProcessIdentity } from "./process_identity.mjs";

runPinGuard();

const EXPECTED_FULL_STACK = [
  "teacher-backend",
  "student-backend",
  "principal-backend",
  "parent-backend",
  "teacher_frontend",
  "student_frontend",
  "principal_frontend",
  "parent_frontend",
];

const report = {
  classification: "NON_PRODUCTION",
  deterministic_mode: true,
  manifest_path: manifestPath,
  fixture_path: fixturePath,
  db_report_path: dbReportPath,
  status_path: statusPath,
};

if (existsSync(statusPath)) {
  report.operator_status = JSON.parse(readFileSync(statusPath, "utf8"));
}
if (existsSync(manifestPath)) {
  report.manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
}
if (existsSync(dbReportPath)) {
  const db = JSON.parse(readFileSync(dbReportPath, "utf8"));
  report.shared_database = db.shared_database;
  report.postgres_major = db.postgres_major;
  report.migration_head = db.migration_head;
  report.container_name = db.container_name;
}

const registry = readProcessRegistry();
const liveChildren = [];
const deadExpected = [];
for (const entry of registry.children ?? []) {
  if (!isPidAlive(entry.pid)) {
    deadExpected.push(entry);
    continue;
  }
  const identity = verifyProcessIdentity(entry.pid, entry);
  if (!identity.ok) {
    deadExpected.push({ ...entry, identity_rejected: identity.reason });
    continue;
  }
  liveChildren.push(entry);
}

report.live_process_count = liveChildren.length;
report.live_processes = liveChildren.map((entry) => ({
  script: entry.script,
  role: entry.role,
  pid: entry.pid,
}));

const operatorPhase = report.operator_status?.phase;
const mode = report.operator_status?.mode ?? "full_stack";
const expectedRoles =
  mode === "backends_only"
    ? ["teacher-backend", "student-backend", "principal-backend", "parent-backend"]
    : EXPECTED_FULL_STACK;

const liveRoles = new Set(liveChildren.map((entry) => entry.role).filter(Boolean));
const missingRoles = expectedRoles.filter((role) => !liveRoles.has(role));
report.missing_expected_roles = missingRoles;

let healthOk = true;
const roleUrls = report.operator_status?.role_urls;
const healthTimeoutMs = Number(
  process.env.AIEOS360_CX01_I01_SHOWCASE_STATUS_HEALTH_TIMEOUT_MS ||
    (process.env.AIEOS360_CX01_I01_SHOWCASE_REQUIRE_LIVE === "1" ? "90000" : "5000"),
);
if (operatorPhase === "running" && roleUrls) {
  const checks = [];
  for (const [role, urls] of Object.entries(roleUrls)) {
    if (urls.backend) {
      const backendUrl = urls.backend.endsWith("/docs")
        ? urls.backend
        : `${urls.backend.replace(/\/$/, "")}/docs`;
      try {
        await waitForHttpOk(backendUrl, healthTimeoutMs);
        checks.push({ role, surface: "backend", ok: true });
      } catch {
        checks.push({ role, surface: "backend", ok: false });
        healthOk = false;
      }
    }
    if (urls.frontend && mode === "full_stack") {
      try {
        await waitForHttpOk(urls.frontend, healthTimeoutMs);
        checks.push({ role, surface: "frontend", ok: true });
      } catch {
        checks.push({ role, surface: "frontend", ok: false });
        healthOk = false;
      }
    }
  }
  report.service_health = checks;
}

if (operatorPhase === "running") {
  if (liveChildren.length === 0) {
    report.effective_phase = "not_running";
    report.live_state_mismatch = true;
  } else if (missingRoles.length > 0 || !healthOk) {
    report.effective_phase = "degraded";
    report.live_state_mismatch = true;
  } else {
    report.effective_phase = "running";
  }
} else {
  report.effective_phase = operatorPhase ?? "unknown";
}

console.log(JSON.stringify(report, null, 2));

if (process.env.AIEOS360_CX01_I01_SHOWCASE_REQUIRE_LIVE === "1") {
  if (report.effective_phase !== "running") {
    process.exit(1);
  }
  if (missingRoles.length > 0) {
    process.exit(1);
  }
  if (mode === "full_stack" && liveChildren.length < expectedRoles.length) {
    process.exit(1);
  }
}
