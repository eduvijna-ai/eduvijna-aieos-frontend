import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(__dirname, "../..");
export const tmpDir = join(repoRoot, "tmp");
export const dbReportPath = join(tmpDir, "aieos360-cx01-i01-showcase-db.json");
export const fixturePath = join(tmpDir, "aieos360-cx01-i01-showcase-fixture.json");
export const manifestPath = join(
  tmpDir,
  "aieos360-cx01-i01-showcase-manifest.json",
);
export const statusPath = join(tmpDir, "aieos360-cx01-i01-showcase-status.json");
export const processesPath = join(
  tmpDir,
  "aieos360-cx01-i01-showcase-processes.json",
);
