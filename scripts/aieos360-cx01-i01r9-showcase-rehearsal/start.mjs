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
} from "./managed_evidence.mjs";
import {
  buildReadinessTargets,
  buildRoleUrls,
} from "./role_urls.mjs";
import {
  assertManagedStartRegistryGate,
  readProcessRegistry,
  spawnDetachedProcessGroup,
  waitForHttpOk,
  writeOperatorStatus,
  writeProcessRegistry,
} from "./process_group.mjs";
import { MODE_DETERMINISTIC } from "../aieos360-cx01-i06-showcase-ai-mode/constants.mjs";
import {
  buildTeacherBackendEnv,
  scrubAllProviderSurface,
} from "../aieos360-cx01-i06-showcase-ai-mode/env_scrub.mjs";
import {
  buildModeConfigRecord,
  persistModeConfig,
  resolveShowcaseModeForStart,
} from "../aieos360-cx01-i06-showcase-ai-mode/mode.mjs";
import {
  fetchTeacherProviderAggregator,
  summarizeProviderTruth,
} from "../aieos360-cx01-i06-showcase-ai-mode/provider_truth.mjs";
import { writeRuntimeSurface } from "../aieos360-cx01-i06-showcase-ai-mode/runtime_surface.mjs";

failClosedNonLinuxExit("showcase:aieos360:start");

const scriptDir = join(repoRoot, "scripts/aieos360-cx01-i01r9-showcase-rehearsal");
const skipReset = process.env.AIEOS360_CX01_I01_SHOWCASE_SKIP_RESET === "1";
const readinessTimeoutMs = Number(
  process.env.AIEOS360_CX01_I01_SHOWCASE_START_READINESS_TIMEOUT_MS || "180000",
);

mkdirSync(tmpDir, { recursive: true });
runPinGuard();

function assertNotAlreadyRunning() {
  const gate = assertManagedStartRegistryGate();
  if (!gate.ok) {
    const entry = gate.entry;
    if (gate.code === "already_running") {
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
    } else {
      console.error(
        JSON.stringify(
          {
            error: "CX01-I01R9 showcase registry has unsafe unresolved evidence",
            code: gate.code,
            pid: entry.pid,
            role: entry.role,
            reason: gate.reason,
          },
          null,
          2,
        ),
      );
    }
    process.exit(1);
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

const governedConfiguredPorts = [
  teacherBe,
  studentBe,
  principalBe,
  parentBe,
  teacherFe,
  studentFe,
  principalFe,
  parentFe,
];

assertNotAlreadyRunning();

const showcaseModeResolution = resolveShowcaseModeForStart();
const showcaseMode = showcaseModeResolution.mode;
persistModeConfig(buildModeConfigRecord(showcaseModeResolution));

await assertPortsAvailable(governedConfiguredPorts);

if (!skipReset) {
  const result = spawnSync("node", [join(scriptDir, "reset.mjs")], {
    stdio: "inherit",
    env: scrubAllProviderSurface(process.env),
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

const commonBackendEnv = scrubAllProviderSurface({
  ...process.env,
  AIEOS_BACKEND_ROOT: backendRoot,
  AIEOS360_CX01_I01_SHOWCASE_SKIP_BOOTSTRAP: "1",
  AIEOS360_CX01_I01_SHOWCASE_RUNTIME_DATABASE_URL: dbReport.runtime_database_url,
  AIEOS360_CX01_I01_SHOWCASE_BOOTSTRAP_DATABASE_URL: dbReport.bootstrap_database_url,
  AIEOS360_CX01_I01_SHOWCASE_DB_REPORT: dbReportPath,
  AIEOS360_CX01_I01_SHOWCASE_FIXTURE_PATH: fixturePath,
  PYTHONPATH: pythonPath,
});

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
    env: scrubAllProviderSurface({
      ...process.env,
      VITE_DEV_API_PROXY_TARGET: `http://127.0.0.1:${backendPort}`,
      AIEOS360_CX01_I06_SHOWCASE_MODE: showcaseMode,
    }),
    role: `${role}_frontend`,
    script: `vite:${port}`,
    port,
  });
}

try {
  const teacherBackendEnv = buildTeacherBackendEnv(
    commonBackendEnv,
    showcaseMode,
    process.env,
  );
  spawnDetachedProcessGroup({
    command: uv,
    args: ["run", "python", join(scriptDir, "serve_teacher_app.py")],
    cwd: backendRoot,
    env: {
      ...teacherBackendEnv,
      AIEOS360_CX01_I01_SHOWCASE_TEACHER_BACKEND_PORT: String(teacherBe),
    },
    role: "teacher-backend",
    script: "serve_teacher_app.py",
    port: teacherBe,
  });
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

  let providerTruth = {
    selected_mode: showcaseMode,
    verified_runtime_mode: showcaseMode,
    active_provider_id: showcaseMode === MODE_DETERMINISTIC ? "fake" : null,
    active_model_id: showcaseMode === MODE_DETERMINISTIC ? "fake-model" : null,
    aggregator_mode: showcaseMode === MODE_DETERMINISTIC ? "DEVELOPMENT_FAKE" : null,
    real_provider_generation_verified: false,
    verification_state:
      showcaseMode === MODE_DETERMINISTIC
        ? "deterministic_fixture_runtime"
        : "real_ai_selected_not_verified",
  };
  let providerAggregator = null;
  try {
    providerAggregator = await fetchTeacherProviderAggregator(
      roleUrls.teacher.backend,
      readinessTimeoutMs,
    );
    providerTruth = summarizeProviderTruth(showcaseMode, providerAggregator);
  } catch (error) {
    if (showcaseMode !== MODE_DETERMINISTIC) {
      throw new Error(
        `REAL_AI provider aggregator verification failed before declaring running: ${error}`,
      );
    }
  }

  writeRuntimeSurface({
    selected_mode: providerTruth.selected_mode,
    verified_runtime_mode: providerTruth.verified_runtime_mode,
    active_provider_id: providerTruth.active_provider_id,
    active_model_id: providerTruth.active_model_id,
    verification_state: providerTruth.verification_state,
    real_provider_generation_verified:
      providerTruth.real_provider_generation_verified,
    seeded_worksheet_origin: "synthetic_prerequisite_fixture",
    operator_control: "env_before_start",
  });

  writeOperatorStatus({
    phase: "running",
    classification: "NON_PRODUCTION",
    mode: "full_stack",
    start_mode: "managed",
    platform: "linux",
    showcase_mode: showcaseMode,
    showcase_mode_truth: providerTruth,
    deterministic_mode: showcaseMode === MODE_DETERMINISTIC,
    role_urls: roleUrls,
    governed_ports: governedConfiguredPorts,
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
    await assertPortsReleased(governedConfiguredPorts);
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
    configured_governed_ports: governedConfiguredPorts,
    governed_app_ports_released: portsReleased,
    port_release_error: portReleaseError,
    managed_evidence_after_cleanup: managedEvidence,
    failed_at: new Date().toISOString(),
  });
  console.error(error);
  process.exit(1);
}
