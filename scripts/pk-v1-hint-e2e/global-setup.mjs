import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const tmpDir = join(repoRoot, "tmp");
const fixturePath = join(tmpDir, "pk-v1-hint-e2e-fixture.json");
const dbReportPath = join(tmpDir, "pk-v1-hint-e2e-db.json");

export default async function globalSetup() {
  mkdirSync(tmpDir, { recursive: true });
  process.env.PK_V1_HINT_E2E_FIXTURE_PATH = fixturePath;
  process.env.PK_V1_HINT_E2E_DB_REPORT = dbReportPath;
  writeFileSync(
    join(tmpDir, "pk-v1-hint-e2e-env.json"),
    JSON.stringify({ fixturePath, dbReportPath }, null, 2) + "\n",
    "utf8",
  );
}
