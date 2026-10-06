#!/usr/bin/env node
/**
 * Start CX01-I01 showcase rehearsal role stacks (4 backends + 4 Vite frontends).
 * NON_PRODUCTION — runs reset unless AIEOS360_CX01_I01_SHOWCASE_SKIP_RESET=1.
 */
import { spawn, spawnSync } from "node:child_process";
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
} from "./constants.mjs";
import { runPinGuard } from "./pin_guard.mjs";
import { assertPortsAvailable } from "./port_guard.mjs";
import {
  appendProcessChild,
  isPidAlive,
  readProcessRegistry,
  waitForHttpOk,
  writeOperatorStatus,
  writeProcessRegistry,
} from "./process_registry.mjs";
import {
  dbReportPath,
  fixturePath,
  repoRoot,
  statusPath,
  tmpDir,
} from "./paths.mjs";
import {
  buildChildRegistryEntry,
  CHILD_OWNERSHIP_ENV,
  newChildOwnershipToken,
  newParentRunId,
  PARENT_RUN_ENV,
  verifyRegistryEntryOwnership,
} from "./process_identity.mjs";
import { executeCanonicalShutdown } from "./canonical_shutdown.mjs";

const scriptDir = join(repoRoot, "scripts/aieos360-cx01-i01-showcase-rehearsal");
const ownedLauncherPath = join(scriptDir, "owned_child_launcher.mjs");
const skipReset = process.env.AIEOS360_CX01_I01_SHOWCASE_SKIP_RESET === "1";
const interactiveSignalProof =
  process.env.AIEOS360_CX01_I01_SHOWCASE_INTERACTIVE_SIGNAL_PROOF === "1";
const startMode =
  process.env.AIEOS360_CX01_I01_SHOWCASE_START_MODE === "managed"
    ? "managed"
    : "interactive";
const readinessTimeoutMs = Number(
  process.env.AIEOS360_CX01_I01_SHOWCASE_START_READINESS_TIMEOUT_MS || "180000",
);
const parentRunId = newParentRunId();

mkdirSync(tmpDir, { recursive: true });
runPinGuard();

function assertNotAlreadyRunning() {
  const existing = readProcessRegistry();
  for (const entry of existing.children ?? []) {
    if (!isPidAlive(entry.pid)) {
      continue;
    }
    const identity = verifyRegistryEntryOwnership(entry.pid, entry);
    if (!identity.ok) {
      continue;
    }
    console.error(
      JSON.stringify(
        {
          error: "CX01 showcase already running",
          pid: entry.pid,
          script: entry.script,
        },
        null,
        2,
      ),
    );
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

assertNotAlreadyRunning();

if (!interactiveSignalProof) {
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
}

const dbReport = interactiveSignalProof
  ? null
  : JSON.parse(readFileSync(dbReportPath, "utf8"));
writeProcessRegistry({ children: [], parentRunId });

const spawned = [];

async function cleanupOwned(reason) {
  const shutdown = await executeCanonicalShutdown({
    expectContainer: false,
  });
  if (shutdown.phase !== "stopped") {
    writeOperatorStatus({
      phase: "start_failed",
      classification: "NON_PRODUCTION",
      failure_reason: reason,
      shutdown_phase: shutdown.phase,
      partial_children: spawned.map(({ pid, role, script }) => ({
        pid,
        role,
        script,
      })),
      failed_at: new Date().toISOString(),
    });
    writeProcessRegistry({
      parentRunId,
      children: spawned.filter((e) => isPidAlive(e.pid)),
    });
    return;
  }
  writeOperatorStatus({
    phase: "start_failed",
    classification: "NON_PRODUCTION",
    failure_reason: reason,
    partial_children: spawned.map(({ pid, role, script }) => ({
      pid,
      role,
      script,
    })),
    failed_at: new Date().toISOString(),
  });
}

function registerSpawnedChild(script, role, child) {
  const entry = buildChildRegistryEntry({
    script,
    role,
    pid: child.pid,
    parentRunId,
    ownershipToken: child.__cx01OwnershipToken,
  });
  spawned.push(entry);
  appendProcessChild(entry);
  return child;
}

function spawnOwned(scriptPath, registryScript, role, extraEnv = {}, scriptArgs = []) {
  const managed = startMode === "managed";
  const ownershipToken = newChildOwnershipToken();
  const child = spawn(
    process.execPath,
    [ownedLauncherPath, ownershipToken, scriptPath, ...scriptArgs],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        [CHILD_OWNERSHIP_ENV]: ownershipToken,
        [PARENT_RUN_ENV]: parentRunId,
        AIEOS360_CX01_I01_SHOWCASE_SKIP_BOOTSTRAP: "1",
        AIEOS360_CX01_I01_SHOWCASE_RUNTIME_DATABASE_URL: dbReport.runtime_database_url,
        AIEOS360_CX01_I01_SHOWCASE_BOOTSTRAP_DATABASE_URL: dbReport.bootstrap_database_url,
        AIEOS360_CX01_I01_SHOWCASE_DB_REPORT: dbReportPath,
        AIEOS360_CX01_I01_SHOWCASE_FIXTURE_PATH: fixturePath,
        ...extraEnv,
      },
      stdio: managed ? "ignore" : "inherit",
      detached: managed,
    },
  );
  child.__cx01OwnershipToken = ownershipToken;
  if (managed) {
    child.unref();
  }
  registerSpawnedChild(registryScript, role, child);
  maybeInjectPartialStartFailure();
  return child;
}

function spawnNode(script, extraEnv = {}) {
  const role = script
    .replace(/^start-/, "")
    .replace(/-backend\.mjs$/, "-backend")
    .replace(/\.mjs$/, "");
  return spawnOwned(join(scriptDir, script), script, role, extraEnv);
}

function spawnVite(port, backendPort, role) {
  const viteBin = join(repoRoot, "node_modules/vite/bin/vite.js");
  return spawnOwned(
    viteBin,
    `vite:${port}`,
    `${role}_frontend`,
    { VITE_DEV_API_PROXY_TARGET: `http://127.0.0.1:${backendPort}` },
    ["--host", "127.0.0.1", "--port", String(port), "--strictPort"],
  );
}

const injectPartialAfter = Number(
  process.env.AIEOS360_CX01_I01_SHOWCASE_INJECT_PARTIAL_START_AFTER || "0",
);
function maybeInjectPartialStartFailure() {
  if (injectPartialAfter > 0 && spawned.length >= injectPartialAfter) {
    throw new Error(
      `injected partial start failure after ${spawned.length} children`,
    );
  }
}

function attachInteractiveShutdownHandlers() {
  let interactiveShutdownInProgress = false;
  const runInteractiveShutdown = async () => {
    if (interactiveShutdownInProgress) {
      return;
    }
    interactiveShutdownInProgress = true;
    const shutdown = await executeCanonicalShutdown({
      expectContainer:
        process.env.AIEOS360_CX01_I01_SHOWCASE_STOP_EXPECT_CONTAINER !== "0",
      simulateStopFailure:
        process.env.AIEOS360_CX01_I01_SHOWCASE_INTERACTIVE_SIGNAL_PROOF_FAIL ===
        "1",
    });
    if (shutdown.phase === "stop_failed") {
      process.exitCode = 1;
    }
    process.exit(process.exitCode ?? 0);
  };
  process.on("SIGINT", () => {
    void runInteractiveShutdown();
  });
  process.on("SIGTERM", () => {
    void runInteractiveShutdown();
  });
}

try {
  if (interactiveSignalProof) {
    if (startMode !== "interactive") {
      throw new Error("interactive signal proof requires interactive start mode");
    }
    const childScript = join(scriptDir, "interactive_signal_child.mjs");
    for (const role of ["teacher-backend", "student-backend"]) {
      const ownershipToken = newChildOwnershipToken();
      const child = spawn(
        process.execPath,
        [ownedLauncherPath, ownershipToken, childScript],
        {
          cwd: repoRoot,
          env: {
            ...process.env,
            [CHILD_OWNERSHIP_ENV]: ownershipToken,
            [PARENT_RUN_ENV]: parentRunId,
          },
          stdio: "ignore",
          detached: false,
        },
      );
      child.__cx01OwnershipToken = ownershipToken;
      registerSpawnedChild("interactive_signal_child.mjs", role, child);
    }
    writeOperatorStatus({
      phase: "running",
      classification: "NON_PRODUCTION",
      signal_proof_harness: true,
      parent_run_id: parentRunId,
      started_at: new Date().toISOString(),
    });
    console.log("CX01_INTERACTIVE_SIGNAL_PROOF_READY");
    attachInteractiveShutdownHandlers();
    await new Promise(() => {});
  }

  spawnNode("start-teacher-backend.mjs", {
    AIEOS360_CX01_I01_SHOWCASE_TEACHER_BACKEND_PORT: String(teacherBe),
  });
  spawnNode("start-student-backend.mjs", {
    AIEOS360_CX01_I01_SHOWCASE_STUDENT_BACKEND_PORT: String(studentBe),
  });
  spawnNode("start-principal-backend.mjs", {
    AIEOS360_CX01_I01_SHOWCASE_PRINCIPAL_BACKEND_PORT: String(principalBe),
  });
  spawnNode("start-parent-backend.mjs", {
    AIEOS360_CX01_I01_SHOWCASE_PARENT_BACKEND_PORT: String(parentBe),
  });

  spawnVite(teacherFe, teacherBe, "teacher");
  spawnVite(studentFe, studentBe, "student");
  spawnVite(principalFe, principalBe, "principal");
  spawnVite(parentFe, parentBe, "parent");

  const readiness = [
    {
      role: "teacher",
      backend: `http://127.0.0.1:${teacherBe}/docs`,
      frontend: `http://127.0.0.1:${teacherFe}`,
    },
    {
      role: "student",
      backend: `http://127.0.0.1:${studentBe}/docs`,
      frontend: `http://127.0.0.1:${studentFe}`,
    },
    {
      role: "principal",
      backend: `http://127.0.0.1:${principalBe}/docs`,
      frontend: `http://127.0.0.1:${principalFe}`,
    },
    {
      role: "parent",
      backend: `http://127.0.0.1:${parentBe}/docs`,
      frontend: `http://127.0.0.1:${parentFe}`,
    },
  ];
  for (const target of readiness) {
    await waitForHttpOk(target.backend, readinessTimeoutMs);
    await waitForHttpOk(target.frontend, readinessTimeoutMs);
  }

  writeOperatorStatus({
    phase: "running",
    classification: "NON_PRODUCTION",
    mode: "full_stack",
    start_mode: startMode,
    parent_run_id: parentRunId,
    role_urls: {
      teacher: {
        frontend: `http://127.0.0.1:${teacherFe}`,
        backend: `http://127.0.0.1:${teacherBe}`,
      },
      student: {
        frontend: `http://127.0.0.1:${studentFe}`,
        backend: `http://127.0.0.1:${studentBe}`,
      },
      principal: {
        frontend: `http://127.0.0.1:${principalFe}`,
        backend: `http://127.0.0.1:${principalBe}`,
      },
      parent: {
        frontend: `http://127.0.0.1:${parentFe}`,
        backend: `http://127.0.0.1:${parentBe}`,
      },
    },
    expected_children: [
      "teacher-backend",
      "student-backend",
      "principal-backend",
      "parent-backend",
      "teacher_frontend",
      "student_frontend",
      "principal_frontend",
      "parent_frontend",
    ],
    processes_path: statusPath,
    started_at: new Date().toISOString(),
  });

  if (startMode === "managed") {
    console.log(
      JSON.stringify(
        {
          started: true,
          classification: "NON_PRODUCTION",
          mode: "full_stack",
          start_mode: "managed",
          child_count: spawned.length,
          readiness_verified: true,
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  console.log(
    "AIEOS360-CX01-I01 showcase rehearsal started (NON_PRODUCTION). Press Ctrl+C to stop.",
  );
} catch (error) {
  await cleanupOwned(String(error));
  console.error(error);
  process.exit(1);
}

if (startMode === "interactive" && !interactiveSignalProof) {
  attachInteractiveShutdownHandlers();
}
