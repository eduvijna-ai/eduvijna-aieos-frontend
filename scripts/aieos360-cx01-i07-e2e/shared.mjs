import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  dbReportPath,
  fixturePath,
} from "../aieos360-cx01-i01r9-showcase-rehearsal/paths.mjs";
import { BACKEND_PIN_SHA, resolveBackendRoot } from "./constants.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const repoRoot = join(__dirname, "../..");
export const i01ScriptDir = join(
  repoRoot,
  "scripts/aieos360-cx01-i01r9-showcase-rehearsal",
);

export { dbReportPath, fixturePath };

export function verifyBackendPin() {
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

export function runI01Python(scriptName, extraEnv = {}) {
  const backendRoot = resolveBackendRoot();
  const scriptPath = join(i01ScriptDir, scriptName);
  const { VIRTUAL_ENV: _dropVirtualEnv, ...baseEnv } = process.env;
  void _dropVirtualEnv;
  const result = spawnSync(
    process.env.AIEOS360_CX01_I07_E2E_UV || "uv",
    ["run", "python", scriptPath],
    {
      cwd: backendRoot,
      env: {
        ...baseEnv,
        AIEOS_BACKEND_ROOT: backendRoot,
        AIEOS360_CX01_I01_SHOWCASE_DB_REPORT: dbReportPath,
        AIEOS360_CX01_I01_SHOWCASE_FIXTURE_PATH: fixturePath,
        PYTHONPATH: [join(backendRoot, "src"), backendRoot, i01ScriptDir].join(
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

export function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function waitForSharedBootstrap(timeoutMs = 300_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (existsSync(fixturePath)) {
      if (
        process.env.AIEOS360_CX01_I07_E2E_RUNTIME_DATABASE_URL ||
        process.env.AIEOS_TEST_RUNTIME_DATABASE_URL ||
        existsSync(dbReportPath)
      ) {
        return;
      }
    }
    sleepSync(500);
  }
  throw new Error(
    "Timed out waiting for shared CX01-I07 bootstrap/seed (teacher start-backend).",
  );
}

export function resolveRuntimeDatabaseUrl() {
  if (process.env.AIEOS360_CX01_I07_E2E_RUNTIME_DATABASE_URL) {
    return process.env.AIEOS360_CX01_I07_E2E_RUNTIME_DATABASE_URL;
  }
  if (process.env.AIEOS_TEST_RUNTIME_DATABASE_URL) {
    return process.env.AIEOS_TEST_RUNTIME_DATABASE_URL;
  }
  const dbReport = JSON.parse(readFileSync(dbReportPath, "utf8"));
  return dbReport.runtime_database_url;
}

export function showcaseBackendEnv(role) {
  const portKey = `AIEOS360_CX01_I01_SHOWCASE_${role}_BACKEND_PORT`;
  const portEnv = process.env[portKey];
  if (!portEnv) {
    throw new Error(`${portKey} is required for CX01-I07 E2E serve scripts`);
  }
  return { [portKey]: portEnv };
}

export function spawnServeApp(serveScript, role) {
  const backendRoot = resolveBackendRoot();
  const runtimeDatabaseUrl = resolveRuntimeDatabaseUrl();
  const { VIRTUAL_ENV: _dropVirtualEnv, ...baseEnv } = process.env;
  void _dropVirtualEnv;
  const child = spawn(
    process.env.AIEOS360_CX01_I07_E2E_UV || "uv",
    ["run", "python", join(i01ScriptDir, serveScript)],
    {
      cwd: backendRoot,
      env: {
        ...baseEnv,
        AIEOS_BACKEND_ROOT: backendRoot,
        AIEOS360_CX01_I01_SHOWCASE_FIXTURE_PATH: fixturePath,
        AIEOS360_CX01_I01_SHOWCASE_RUNTIME_DATABASE_URL: runtimeDatabaseUrl,
        AIEOS360_CX01_I07_E2E_RUNTIME_DATABASE_URL: runtimeDatabaseUrl,
        AIEOS_TEST_RUNTIME_DATABASE_URL: runtimeDatabaseUrl,
        PYTHONPATH: [join(backendRoot, "src"), backendRoot, i01ScriptDir].join(
          process.platform === "win32" ? ";" : ":",
        ),
        ...showcaseBackendEnv(role),
      },
      stdio: "inherit",
      shell: process.platform === "win32",
    },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
}
