#!/usr/bin/env node
/**
 * Start CX01-I01 showcase rehearsal role stacks (4 backends + 4 Vite frontends).
 * NON_PRODUCTION — runs reset unless AIEOS360_CX01_I01_SHOWCASE_SKIP_RESET=1.
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
import {
  dbReportPath,
  fixturePath,
  processesPath,
  repoRoot,
  statusPath,
  tmpDir,
} from "./paths.mjs";

const scriptDir = join(repoRoot, "scripts/aieos360-cx01-i01-showcase-rehearsal");
const skipReset = process.env.AIEOS360_CX01_I01_SHOWCASE_SKIP_RESET === "1";

mkdirSync(tmpDir, { recursive: true });
runPinGuard();

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
const children = [];

function spawnNode(script, extraEnv = {}) {
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
    stdio: "inherit",
    detached: false,
  });
  children.push({ script, pid: child.pid });
  return child;
}

function spawnVite(port, backendPort) {
  const child = spawn(
    "pnpm",
    ["exec", "vite", "--host", "127.0.0.1", "--port", String(port)],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        VITE_DEV_API_PROXY_TARGET: `http://127.0.0.1:${backendPort}`,
      },
      stdio: "inherit",
      detached: false,
    },
  );
  children.push({ script: `vite:${port}`, pid: child.pid });
  return child;
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

spawnVite(teacherFe, teacherBe);
spawnVite(studentFe, studentBe);
spawnVite(principalFe, principalBe);
spawnVite(parentFe, parentBe);

writeFileSync(processesPath, JSON.stringify({ children }, null, 2) + "\n", "utf8");
writeFileSync(
  statusPath,
  JSON.stringify(
    {
      phase: "running",
      classification: "NON_PRODUCTION",
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
      processes_path: processesPath,
      started_at: new Date().toISOString(),
    },
    null,
    2,
  ) + "\n",
  "utf8",
);

console.log(
  "AIEOS360-CX01-I01 showcase rehearsal started (NON_PRODUCTION). Press Ctrl+C to stop.",
);

process.on("SIGINT", () => {
  for (const entry of children) {
    try {
      process.kill(entry.pid, "SIGINT");
    } catch {
      /* ignore */
    }
  }
  process.exit(0);
});
