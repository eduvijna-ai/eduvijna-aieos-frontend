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
for (const entry of registry.children ?? []) {
  const identity = verifyRegistryEntry(entry);
  if (identity.ok) {
    liveChildren.push(entry);
  }
}

report.live_process_count = liveChildren.length;
report.live_processes = liveChildren.map((entry) => ({
  role: entry.role,
  pid: entry.pid,
  port: entry.port,
}));

const operatorPhase = report.operator_status?.phase;
const roleUrls = report.operator_status?.role_urls;
const requireLive = process.env.AIEOS360_CX01_I01_SHOWCASE_REQUIRE_LIVE === "1";
const healthTimeoutMs = Number(
  process.env.AIEOS360_CX01_I01_SHOWCASE_STATUS_HEALTH_TIMEOUT_MS ||
    (requireLive ? "90000" : "5000"),
);

if (operatorPhase === "running" && roleUrls && requireLive) {
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
      console.error(JSON.stringify(report, null, 2));
      process.exit(1);
    }
  }
  report.health_checks = checks;
}

if (requireLive && operatorPhase !== "running") {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(report, null, 2));
