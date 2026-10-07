#!/usr/bin/env node
/**
 * Managed start for AIEOS360-CX01-I01R9 showcase rehearsal (Linux only).
 * Lifecycle: reset → start → status → stop (no interactive supervisor).
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_PARENT_BACKEND_PORT,
  DEFAULT_PARENT_FRONTEND_PORT,
  DEFAULT_PRINCIPAL_BACKEND_PORT,
  DEFAULT_PRINCIPAL_FRONTEND_PORT,
  DEFAULT_STUDENT_BACKEND_PORT,
  DEFAULT_STUDENT_FRONTEND_PORT,
  DEFAULT_TEACHER_BACKEND_PORT,
  DEFAULT_TEACHER_FRONTEND_PORT,
  resolveBackendRoot,
} from "./constants.mjs";
import { failClosedNonLinuxExit } from "./linux_platform.mjs";
import { runPinGuard } from "./pin_guard.mjs";
import { assertPortsAvailable } from "./port_guard.mjs";
import {
  dbReportPath,
  fixturePath,
  repoRoot,
  statusPath,
  tmpDir,
} from "./paths.mjs";
import { cleanupManagedStack } from "./managed_cleanup.mjs";
import {
  assertPortsReleased,
  collectManagedEvidence,
  DEFAULT_GOVERNED_APP_PORTS,
} from "./managed_evidence.mjs";
import {
  buildReadinessTargets,
  buildRoleUrls,
} from "./role_urls.mjs";
import {
  readProcessRegistry,
  spawnDetachedProcessGroup,
  verifyRegistryEntry,
  waitForHttpOk,
  writeOperatorStatus,
  writeProcessRegistry,
} from "./process_group.mjs";

failClosedNonLinuxExit("showcase:aieos360:start");

const scriptDir = join(repoRoot, "scripts/aieos360-cx01-i01r9-showcase-rehearsal");
const skipReset = process.env.AIEOS360_CX01_I01_SHOWCASE_SKIP_RESET === "1";
const readinessTimeoutMs = Number(
  process.env.AIEOS360_CX01_I01_SHOWCASE_START_READINESS_TIMEOUT_MS || "180000",
);

mkdirSync(tmpDir, { recursive: true });
runPinGuard();

function assertNotAlreadyRunning() {
  const registry = readProcessRegistry();
  for (const entry of registry.children ?? []) {
    const identity = verifyRegistryEntry(entry);
    if (identity.ok) {
      console.error(
        JSON.stringify(
          {
            error: "CX01-I01R9 showcase already running",
            pid: entry.pid,
            role: entry.role,
          },
          null,
          2,
        ),
      );
      process.exit(1);
    }
  }
}

const teacherBe = Number(
  process.env.AIEOS360_CX01_I01_SHOWCASE_TEACHER_BACKEND_PORT ||
    DEFAULT_TEACHER_BACKEND_PORT,
);
const studentBe = Number(
  process.env.AIEOS360_CX01_I01_SHOWCASE_STUDENT_BACKEND_PORT ||
    DEFAULT_STUDENT_BACKEND_PORT,
);
const principalBe = Number(
  process.env.AIEOS360_CX01_I01_SHOWCASE_PRINCIPAL_BACKEND_PORT ||
    DEFAULT_PRINCIPAL_BACKEND_PORT,
);
const parentBe = Number(
  process.env.AIEOS360_CX01_I01_SHOWCASE_PARENT_BACKEND_PORT ||
    DEFAULT_PARENT_BACKEND_PORT,
);
const teacherFe = Number(
  process.env.AIEOS360_CX01_I01_SHOWCASE_TEACHER_FRONTEND_PORT ||
    DEFAULT_TEACHER_FRONTEND_PORT,
);
const studentFe = Number(
  process.env.AIEOS360_CX01_I01_SHOWCASE_STUDENT_FRONTEND_PORT ||
    DEFAULT_STUDENT_FRONTEND_PORT,
);
const principalFe = Number(
  process.env.AIEOS360_CX01_I01_SHOWCASE_PRINCIPAL_FRONTEND_PORT ||
    DEFAULT_PRINCIPAL_FRONTEND_PORT,
);
const parentFe = Number(
  process.env.AIEOS360_CX01_I01_SHOWCASE_PARENT_FRONTEND_PORT ||
    DEFAULT_PARENT_FRONTEND_PORT,
);

assertNotAlreadyRunning();

await assertPortsAvailable([
  teacherBe,
  studentBe,
  principalBe,
  parentBe,
  teacherFe,
  studentFe,
  principalFe,
  parentFe,
]);

if (!skipReset) {
  const result = spawnSync("node", [join(scriptDir, "reset.mjs")], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const dbReport = JSON.parse(readFileSync(dbReportPath, "utf8"));
writeProcessRegistry({ children: [] });

const backendRoot = resolveBackendRoot();
const uv = process.env.AIEOS360_CX01_I01_SHOWCASE_UV || "uv";
const pythonPath = [join(backendRoot, "src"), backendRoot, scriptDir].join(":");

const commonBackendEnv = {
  ...process.env,
  AIEOS_BACKEND_ROOT: backendRoot,
  AIEOS360_CX01_I01_SHOWCASE_SKIP_BOOTSTRAP: "1",
  AIEOS360_CX01_I01_SHOWCASE_RUNTIME_DATABASE_URL: dbReport.runtime_database_url,
  AIEOS360_CX01_I01_SHOWCASE_BOOTSTRAP_DATABASE_URL: dbReport.bootstrap_database_url,
  AIEOS360_CX01_I01_SHOWCASE_DB_REPORT: dbReportPath,
  AIEOS360_CX01_I01_SHOWCASE_FIXTURE_PATH: fixturePath,
  PYTHONPATH: pythonPath,
};

function spawnBackend(role, serveScript, portEnvKey, port) {
  return spawnDetachedProcessGroup({
    command: uv,
    args: ["run", "python", join(scriptDir, serveScript)],
    cwd: backendRoot,
    env: { ...commonBackendEnv, [portEnvKey]: String(port) },
    role: `${role}-backend`,
    script: serveScript,
    port,
  });
}

function spawnVite(role, port, backendPort) {
  const viteBin = join(repoRoot, "node_modules/vite/bin/vite.js");
  return spawnDetachedProcessGroup({
    command: process.execPath,
    args: [
      viteBin,
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
    ],
    cwd: repoRoot,
    env: {
      ...process.env,
      VITE_DEV_API_PROXY_TARGET: `http://127.0.0.1:${backendPort}`,
    },
    role: `${role}_frontend`,
    script: `vite:${port}`,
    port,
  });
}

try {
  spawnBackend(
    "teacher",
    "serve_teacher_app.py",
    "AIEOS360_CX01_I01_SHOWCASE_TEACHER_BACKEND_PORT",
    teacherBe,
  );
  spawnBackend(
    "student",
    "serve_student_app.py",
    "AIEOS360_CX01_I01_SHOWCASE_STUDENT_BACKEND_PORT",
    studentBe,
  );
  spawnBackend(
    "principal",
    "serve_principal_app.py",
    "AIEOS360_CX01_I01_SHOWCASE_PRINCIPAL_BACKEND_PORT",
    principalBe,
  );
  spawnBackend(
    "parent",
    "serve_parent_app.py",
    "AIEOS360_CX01_I01_SHOWCASE_PARENT_BACKEND_PORT",
    parentBe,
  );

  spawnVite("teacher", teacherFe, teacherBe);
  spawnVite("student", studentFe, studentBe);
  spawnVite("principal", principalFe, principalBe);
  spawnVite("parent", parentFe, parentBe);

  const roleUrls = buildRoleUrls({
    teacherFe,
    studentFe,
    principalFe,
    parentFe,
    teacherBe,
    studentBe,
    principalBe,
    parentBe,
  });

  for (const target of buildReadinessTargets(roleUrls)) {
    await waitForHttpOk(target.backend, readinessTimeoutMs);
    await waitForHttpOk(target.frontend, readinessTimeoutMs);
  }

  writeOperatorStatus({
    phase: "running",
    classification: "NON_PRODUCTION",
    mode: "full_stack",
    start_mode: "managed",
    platform: "linux",
    role_urls: roleUrls,
    governed_ports: [
      teacherBe,
      studentBe,
      principalBe,
      parentBe,
      teacherFe,
      studentFe,
      principalFe,
      parentFe,
    ],
    status_path: statusPath,
    started_at: new Date().toISOString(),
  });

  console.log(
    JSON.stringify(
      {
        started: true,
        classification: "NON_PRODUCTION",
        mode: "full_stack",
        start_mode: "managed",
        child_count: readProcessRegistry().children?.length ?? 0,
        readiness_verified: true,
      },
      null,
      2,
    ),
  );
} catch (error) {
  const cleanup = await cleanupManagedStack({ removeOwnedLocalContainer: false });
  let portsReleased = false;
  let portReleaseError = null;
  try {
    await assertPortsReleased(DEFAULT_GOVERNED_APP_PORTS);
    portsReleased = true;
  } catch (portError) {
    portReleaseError = String(portError);
  }
  const managedEvidence = collectManagedEvidence();
  writeOperatorStatus({
    phase: "start_failed",
    classification: "NON_PRODUCTION",
    failure_reason: String(error),
    cleanup_process_groups: cleanup,
    governed_app_ports_released: portsReleased,
    port_release_error: portReleaseError,
    managed_evidence_after_cleanup: managedEvidence,
    failed_at: new Date().toISOString(),
  });
  console.error(error);
  process.exit(1);
}
