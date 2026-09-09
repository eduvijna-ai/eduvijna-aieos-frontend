import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BACKEND_PIN_SHA, resolveBackendRoot } from "./constants.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../..");
const tmpDir = join(repoRoot, "tmp");
const dbReportPath = join(tmpDir, "aieos360-i05-e2e-db.json");
const fixturePath = join(tmpDir, "aieos360-i05-e2e-fixture.json");
const serveScriptPath = join(__dirname, "serve_student_app.py");

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

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function waitForSharedBootstrap(timeoutMs = 300_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    // Fixture is written only after teacher bootstrap+seed completes.
    if (existsSync(fixturePath)) {
      if (
        process.env.AIEOS360_I05_E2E_RUNTIME_DATABASE_URL ||
        process.env.AIEOS_TEST_RUNTIME_DATABASE_URL ||
        existsSync(dbReportPath)
      ) {
        return;
      }
    }
    sleepSync(500);
  }
  throw new Error(
    "Timed out waiting for shared I05 bootstrap/seed (teacher start-backend).",
  );
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
waitForSharedBootstrap();

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
