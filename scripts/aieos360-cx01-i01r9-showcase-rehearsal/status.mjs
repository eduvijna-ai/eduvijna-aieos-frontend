#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import {
  dbReportPath,
  fixturePath,
  manifestPath,
  statusPath,
} from "./paths.mjs";
import { runPinGuard } from "./pin_guard.mjs";
import {
  readProcessRegistry,
  verifyRegistryEntry,
  waitForHttpOk,
} from "./process_group.mjs";

const EXPECTED_MANAGED_ROLES = [
  "teacher-backend",
  "student-backend",
  "principal-backend",
  "parent-backend",
  "teacher_frontend",
  "student_frontend",
  "principal_frontend",
  "parent_frontend",
];

runPinGuard();

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
const staleRegistryEntries = [];
for (const entry of registry.children ?? []) {
  const identity = verifyRegistryEntry(entry);
  if (identity.ok) {
    liveChildren.push(entry);
  } else {
    staleRegistryEntries.push({ ...entry, reason: identity.reason });
  }
}

report.live_process_count = liveChildren.length;
report.live_processes = liveChildren.map((entry) => ({
  role: entry.role,
  pid: entry.pid,
  port: entry.port,
}));
report.stale_registry_entries = staleRegistryEntries;

const operatorPhase = report.operator_status?.phase;
const roleUrls = report.operator_status?.role_urls;
const skipLive = process.env.AIEOS360_CX01_I01_SHOWCASE_STATUS_SKIP_LIVE === "1";
const healthTimeoutMs = Number(
  process.env.AIEOS360_CX01_I01_SHOWCASE_STATUS_HEALTH_TIMEOUT_MS || "90000",
);

function failStatus(extra = {}) {
  console.error(JSON.stringify({ ...report, ...extra }, null, 2));
  process.exit(1);
}

if (operatorPhase === "running") {
  const liveRoles = new Set(liveChildren.map((entry) => entry.role));
  const missingRoles = EXPECTED_MANAGED_ROLES.filter((role) => !liveRoles.has(role));
  report.expected_managed_roles = EXPECTED_MANAGED_ROLES;
  report.missing_live_roles = missingRoles;

  if (missingRoles.length > 0 || staleRegistryEntries.length > 0) {
    report.registry_truth = "stale_or_incomplete";
    failStatus({ readiness_ok: false });
  }
  report.registry_truth = "live_registry_matches_expected";

  if (!skipLive && roleUrls) {
    const checks = [];
    for (const [role, urls] of Object.entries(roleUrls)) {
      const backendUrl = urls.backend.endsWith("/docs")
        ? urls.backend
        : `${urls.backend.replace(/\/$/, "")}/docs`;
      try {
        await waitForHttpOk(backendUrl, healthTimeoutMs);
        checks.push({ role, surface: "backend", ok: true });
        await waitForHttpOk(urls.frontend, healthTimeoutMs);
        checks.push({ role, surface: "frontend", ok: true });
      } catch {
        checks.push({ role, surface: "health", ok: false });
        failStatus({ readiness_ok: false, health_checks: checks });
      }
    }
    report.health_checks = checks;
    report.readiness_ok = true;
  }
}

if (operatorPhase === "stopped" && liveChildren.length > 0) {
  report.registry_truth = "orphan_live_processes_after_stopped_phase";
  failStatus();
}

console.log(JSON.stringify(report, null, 2));
