import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fixturePath } from "../aieos360-cx01-i01r9-showcase-rehearsal/paths.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const tmpDir = join(repoRoot, "tmp");
const dbReportPath = join(tmpDir, "aieos360-cx01-i01-showcase-db.json");

export default async function globalSetup() {
  mkdirSync(tmpDir, { recursive: true });
  process.env.AIEOS360_CX01_I07_E2E_FIXTURE_PATH = fixturePath;
  process.env.AIEOS360_CX01_I07_E2E_DB_REPORT = dbReportPath;
  writeFileSync(
    join(tmpDir, "aieos360-cx01-i07-e2e-env.json"),
    JSON.stringify({ fixturePath, dbReportPath }, null, 2) + "\n",
    "utf8",
  );
}
