import { readFileSync } from "node:fs";
import {
  dbReportPath,
  fixturePath,
  isManagedStackRehearse,
  resolveRuntimeDatabaseUrl,
  runI01Python,
  spawnServeApp,
  verifyBackendPin,
} from "./shared.mjs";

verifyBackendPin();

const skipBootstrap =
  process.env.AIEOS360_CX01_I07_E2E_SKIP_BOOTSTRAP === "1" ||
  isManagedStackRehearse();

if (!skipBootstrap) {
  runI01Python("bootstrap_database.py");
  const dbReport = JSON.parse(readFileSync(dbReportPath, "utf8"));
  runI01Python("seed_precondition.py", {
    AIEOS360_CX01_I01_SHOWCASE_RUNTIME_DATABASE_URL: dbReport.runtime_database_url,
    AIEOS360_CX01_I01_SHOWCASE_BOOTSTRAP_DATABASE_URL:
      dbReport.bootstrap_database_url,
  });
  process.env.AIEOS360_CX01_I07_E2E_FIXTURE_PATH = fixturePath;
}

resolveRuntimeDatabaseUrl();
spawnServeApp("serve_teacher_app.py", "TEACHER");
