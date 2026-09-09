import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BACKEND_PIN_SHA, resolveBackendRoot } from "./constants.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../..");
const tmpDir = join(repoRoot, "tmp");
const dbReportPath = join(tmpDir, "aieos360-i05-e2e-db.json");
const fixturePath = join(tmpDir, "aieos360-i05-e2e-fixture.json");
const serveScriptPath = join(__dirname, "serve_teacher_app.py");

function verifyBackendPin() {
  const backendRoot = resolveBackendRoot();
  const backendHead = spawnSync("git", ["-C", backendRoot, "rev-parse", "HEAD"], {
    encoding: "utf8",
  });
  if (backendHead.status !== 0) {
    throw new Error(`Could not read backend HEAD: ${backendHead.stderr}`);
  }
  const head = backendHead.stdout.trim();
  if (head !== BACKEND_PIN_SHA) {
    throw new Error(`Backend HEAD ${head} does not match pin ${BACKEND_PIN_SHA}`);
  }
}

function runPython(scriptName, extraEnv = {}) {
  const backendRoot = resolveBackendRoot();
  const scriptPath = join(__dirname, scriptName);
  const { VIRTUAL_ENV: _dropVirtualEnv, ...baseEnv } = process.env;
  void _dropVirtualEnv;
  const result = spawnSync(
    process.env.AIEOS360_I05_E2E_UV || "uv",
    ["run", "python", scriptPath],
    {
      cwd: backendRoot,
      env: {
        ...baseEnv,
        AIEOS_BACKEND_ROOT: backendRoot,
        AIEOS360_I05_E2E_DB_REPORT: dbReportPath,
        AIEOS360_I05_E2E_FIXTURE_PATH: fixturePath,
        PYTHONPATH: [join(backendRoot, "src"), backendRoot, __dirname].join(
          process.platform === "win32" ? ";" : ":",
        ),
        ...extraEnv,
      },
      encoding: "utf8",
      stdio: "inherit",
      shell: process.platform === "win32",
    },
  );
  if (result.status !== 0) {
    throw new Error(`${scriptName} failed with exit code ${result.status}`);
  }
}

function resolveRuntimeDatabaseUrl() {
  if (process.env.AIEOS360_I05_E2E_RUNTIME_DATABASE_URL) {
    return process.env.AIEOS360_I05_E2E_RUNTIME_DATABASE_URL;
  }
  if (process.env.AIEOS_TEST_RUNTIME_DATABASE_URL) {
    return process.env.AIEOS_TEST_RUNTIME_DATABASE_URL;
  }
  const dbReport = JSON.parse(readFileSync(dbReportPath, "utf8"));
  return dbReport.runtime_database_url;
}

verifyBackendPin();

if (process.env.AIEOS360_I05_E2E_SKIP_BOOTSTRAP !== "1") {
  runPython("bootstrap_database.py");
  const dbReport = JSON.parse(readFileSync(dbReportPath, "utf8"));
  runPython("seed_precondition.py", {
    AIEOS360_I05_E2E_RUNTIME_DATABASE_URL: dbReport.runtime_database_url,
    AIEOS360_I05_E2E_BOOTSTRAP_DATABASE_URL: dbReport.bootstrap_database_url,
  });
  process.env.AIEOS360_I05_E2E_FIXTURE_PATH = fixturePath;
}

const backendRoot = resolveBackendRoot();
const runtimeDatabaseUrl = resolveRuntimeDatabaseUrl();
const { VIRTUAL_ENV: _dropVirtualEnv, ...baseEnv } = process.env;
void _dropVirtualEnv;

const child = spawn(
  process.env.AIEOS360_I05_E2E_UV || "uv",
  ["run", "python", serveScriptPath],
  {
    cwd: backendRoot,
    env: {
      ...baseEnv,
      AIEOS_BACKEND_ROOT: backendRoot,
      AIEOS360_I05_E2E_RUNTIME_DATABASE_URL: runtimeDatabaseUrl,
      AIEOS360_I05_E2E_FIXTURE_PATH: fixturePath,
      PYTHONPATH: [join(backendRoot, "src"), backendRoot].join(
        process.platform === "win32" ? ";" : ":",
      ),
    },
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);

child.on("exit", (code) => process.exit(code ?? 1));
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
