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
import { verifyProcessIdentity } from "./process_identity.mjs";

const scriptDir = join(repoRoot, "scripts/aieos360-cx01-i01-showcase-rehearsal");
const skipReset = process.env.AIEOS360_CX01_I01_SHOWCASE_SKIP_RESET === "1";
const startMode =
  process.env.AIEOS360_CX01_I01_SHOWCASE_START_MODE === "managed"
    ? "managed"
    : "interactive";
const readinessTimeoutMs = Number(
  process.env.AIEOS360_CX01_I01_SHOWCASE_START_READINESS_TIMEOUT_MS || "180000",
);

mkdirSync(tmpDir, { recursive: true });
runPinGuard();

function assertNotAlreadyRunning() {
  const existing = readProcessRegistry();
  for (const entry of existing.children ?? []) {
    if (!isPidAlive(entry.pid)) {
      continue;
    }
    const identity = verifyProcessIdentity(entry.pid, entry);
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

assertNotAlreadyRunning();

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

const spawned = [];

function cleanupOwned(reason) {
  for (const entry of spawned) {
    if (!entry.pid || !isPidAlive(entry.pid)) {
      continue;
    }
    const identity = verifyProcessIdentity(entry.pid, entry);
    if (!identity.ok) {
      continue;
    }
    try {
      process.kill(entry.pid, "SIGTERM");
    } catch {
      /* ignore */
    }
  }
  writeOperatorStatus({
    phase: "start_failed",
    classification: "NON_PRODUCTION",
    failure_reason: reason,
    partial_children: spawned,
    failed_at: new Date().toISOString(),
  });
  writeProcessRegistry({ children: spawned.filter((e) => isPidAlive(e.pid)) });
}

function spawnNode(script, extraEnv = {}) {
  const managed = startMode === "managed";
  const child = spawn("node", [join(scriptDir, script)], {
    env: {
      ...process.env,
      AIEOS360_CX01_I01_SHOWCASE_SKIP_BOOTSTRAP: "1",
      AIEOS360_CX01_I01_SHOWCASE_RUNTIME_DATABASE_URL: dbReport.runtime_database_url,
      AIEOS360_CX01_I01_SHOWCASE_BOOTSTRAP_DATABASE_URL: dbReport.bootstrap_database_url,
      AIEOS360_CX01_I01_SHOWCASE_DB_REPORT: dbReportPath,
      AIEOS360_CX01_I01_SHOWCASE_FIXTURE_PATH: fixturePath,
      ...extraEnv,
    },
    stdio: managed ? "ignore" : "inherit",
    detached: managed,
  });
  if (managed) {
    child.unref();
  }
  const role = script
    .replace(/^start-/, "")
    .replace(/-backend\.mjs$/, "-backend")
    .replace(/\.mjs$/, "");
  const entry = { script, pid: child.pid, role };
  spawned.push(entry);
  appendProcessChild(entry);
  return child;
}

function spawnVite(port, backendPort, role) {
  const managed = startMode === "managed";
  const child = spawn(
    "pnpm",
    ["exec", "vite", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        VITE_DEV_API_PROXY_TARGET: `http://127.0.0.1:${backendPort}`,
      },
      stdio: managed ? "ignore" : "inherit",
      detached: managed,
    },
  );
  if (managed) {
    child.unref();
  }
  const entry = { script: `vite:${port}`, pid: child.pid, role: `${role}_frontend` };
  spawned.push(entry);
  appendProcessChild(entry);
  return child;
}

try {
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
  cleanupOwned(String(error));
  console.error(error);
  process.exit(1);
}

if (startMode === "interactive") {
  process.on("SIGINT", () => {
    for (const entry of spawned) {
      try {
        process.kill(entry.pid, "SIGINT");
      } catch {
        /* ignore */
      }
    }
    process.exit(0);
  });
}
