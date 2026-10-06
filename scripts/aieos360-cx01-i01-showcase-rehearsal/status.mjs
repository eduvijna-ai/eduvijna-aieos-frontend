#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import {
  dbReportPath,
  fixturePath,
  manifestPath,
  statusPath,
} from "./paths.mjs";
import { runPinGuard } from "./pin_guard.mjs";
import { isPidAlive, readProcessRegistry } from "./process_registry.mjs";

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
const liveChildren = (registry.children ?? []).filter((entry) =>
  isPidAlive(entry.pid),
);
report.live_process_count = liveChildren.length;
report.live_processes = liveChildren.map((entry) => ({
  script: entry.script,
  pid: entry.pid,
}));

if (report.operator_status?.phase === "running" && liveChildren.length === 0) {
  report.live_state_mismatch = true;
  report.effective_phase = "not_running";
} else {
  report.effective_phase = report.operator_status?.phase ?? "unknown";
}

console.log(JSON.stringify(report, null, 2));

if (process.env.AIEOS360_CX01_I01_SHOWCASE_REQUIRE_LIVE === "1") {
  if (report.effective_phase !== "running" || liveChildren.length < 4) {
    process.exit(1);
  }
}
