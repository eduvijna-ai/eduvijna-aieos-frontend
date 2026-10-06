#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import {
  dbReportPath,
  fixturePath,
  manifestPath,
  statusPath,
} from "./paths.mjs";
import { runPinGuard } from "./pin_guard.mjs";

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

console.log(JSON.stringify(report, null, 2));
