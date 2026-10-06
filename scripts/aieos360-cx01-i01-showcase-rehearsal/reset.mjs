#!/usr/bin/env node
/**
 * NON_PRODUCTION — destructive reset/reseed for AIEOS360-CX01-I01 showcase rehearsal.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { runPinGuard } from "./pin_guard.mjs";
import { runPython } from "./run-python.mjs";
import {
  dbReportPath,
  fixturePath,
  manifestPath,
  statusPath,
  tmpDir,
} from "./paths.mjs";

mkdirSync(tmpDir, { recursive: true });

if (process.env.AIEOS360_CX01_I01_SHOWCASE_FORCE_RESET_FAIL === "1") {
  console.error("AIEOS360-CX01-I01 injected reset failure (test only)");
  process.exit(1);
}

runPinGuard();

const commonEnv = {
  AIEOS360_CX01_I01_SHOWCASE_DB_REPORT: dbReportPath,
  AIEOS360_CX01_I01_SHOWCASE_FIXTURE_PATH: fixturePath,
  AIEOS360_CX01_I01_SHOWCASE_MANIFEST_PATH: manifestPath,
  AIEOS_TEST_PG_PORT: process.env.AIEOS_TEST_PG_PORT || "55448",
};

runPython("reset_safety.py", commonEnv);
runPython("bootstrap_database.py", commonEnv);

const dbReport = JSON.parse(readFileSync(dbReportPath, "utf8"));

runPython("seed_precondition.py", {
  ...commonEnv,
  AIEOS360_CX01_I01_SHOWCASE_RUNTIME_DATABASE_URL: dbReport.runtime_database_url,
  AIEOS360_CX01_I01_SHOWCASE_BOOTSTRAP_DATABASE_URL: dbReport.bootstrap_database_url,
});

runPython("emit_manifest.py", commonEnv);
runPython("shared_db_proof.py", {
  ...commonEnv,
  AIEOS360_CX01_I01_SHOWCASE_RUNTIME_DATABASE_URL: dbReport.runtime_database_url,
});

const status = {
  phase: "reset_complete",
  classification: "NON_PRODUCTION",
  manifest_path: manifestPath,
  fixture_path: fixturePath,
  db_report_path: dbReportPath,
  shared_database: true,
  deterministic_mode: true,
  updated_at: new Date().toISOString(),
};
writeFileSync(statusPath, JSON.stringify(status, null, 2) + "\n", "utf8");
console.log(JSON.stringify(status, null, 2));
