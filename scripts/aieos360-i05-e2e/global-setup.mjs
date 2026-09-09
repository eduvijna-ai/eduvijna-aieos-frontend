import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const tmpDir = join(repoRoot, "tmp");
const fixturePath = join(tmpDir, "aieos360-i05-e2e-fixture.json");
const dbReportPath = join(tmpDir, "aieos360-i05-e2e-db.json");

export default async function globalSetup() {
  mkdirSync(tmpDir, { recursive: true });
  process.env.AIEOS360_I05_E2E_FIXTURE_PATH = fixturePath;
  process.env.AIEOS360_I05_E2E_DB_REPORT = dbReportPath;
  writeFileSync(
    join(tmpDir, "aieos360-i05-e2e-env.json"),
    JSON.stringify({ fixturePath, dbReportPath }, null, 2) + "\n",
    "utf8",
  );
}
