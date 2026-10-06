#!/usr/bin/env node
/** Start four CX01 role backends only; wait for readiness before reporting running. */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_PARENT_BACKEND_PORT,
  DEFAULT_PRINCIPAL_BACKEND_PORT,
  DEFAULT_STUDENT_BACKEND_PORT,
  DEFAULT_TEACHER_BACKEND_PORT,
} from "./constants.mjs";
import { assertPortsAvailable } from "./port_guard.mjs";
import {
  isPidAlive,
  readProcessRegistry,
  waitForHttpOk,
  writeOperatorStatus,
  writeProcessRegistry,
} from "./process_registry.mjs";
import { dbReportPath, fixturePath, repoRoot } from "./paths.mjs";

const scriptDirPath = join(repoRoot, "scripts/aieos360-cx01-i01-showcase-rehearsal");

const dbReport = JSON.parse(readFileSync(dbReportPath, "utf8"));
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

await assertPortsAvailable([teacherBe, studentBe, principalBe, parentBe]);

const existing = readProcessRegistry();
for (const entry of existing.children ?? []) {
  if (isPidAlive(entry.pid)) {
    throw new Error(
      `CX01 showcase backends already running (pid ${entry.pid} for ${entry.script})`,
    );
  }
}

const children = [];
function spawnNode(script, extraEnv = {}) {
  const child = spawn("node", [join(scriptDirPath, script)], {
    env: {
      ...process.env,
      AIEOS360_CX01_I01_SHOWCASE_SKIP_BOOTSTRAP: "1",
      AIEOS360_CX01_I01_SHOWCASE_RUNTIME_DATABASE_URL: dbReport.runtime_database_url,
      AIEOS360_CX01_I01_SHOWCASE_BOOTSTRAP_DATABASE_URL: dbReport.bootstrap_database_url,
      AIEOS360_CX01_I01_SHOWCASE_DB_REPORT: dbReportPath,
      AIEOS360_CX01_I01_SHOWCASE_FIXTURE_PATH: fixturePath,
      ...extraEnv,
    },
    stdio: "ignore",
    detached: true,
  });
  child.unref();
  children.push({ script, pid: child.pid, kind: "backend" });
  return child;
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

const readiness = [
  { role: "teacher", url: `http://127.0.0.1:${teacherBe}/docs` },
  { role: "student", url: `http://127.0.0.1:${studentBe}/docs` },
  { role: "principal", url: `http://127.0.0.1:${principalBe}/docs` },
  { role: "parent", url: `http://127.0.0.1:${parentBe}/docs` },
];

for (const target of readiness) {
  await waitForHttpOk(target.url);
}

writeProcessRegistry({ children });
writeOperatorStatus({
  phase: "running",
  classification: "NON_PRODUCTION",
  mode: "backends_only",
  role_urls: {
    teacher: { backend: `http://127.0.0.1:${teacherBe}` },
    student: { backend: `http://127.0.0.1:${studentBe}` },
    principal: { backend: `http://127.0.0.1:${principalBe}` },
    parent: { backend: `http://127.0.0.1:${parentBe}` },
  },
  readiness_verified: readiness.map((item) => item.role),
  started_at: new Date().toISOString(),
});

console.log(JSON.stringify({ phase: "running", readiness_verified: true }, null, 2));
