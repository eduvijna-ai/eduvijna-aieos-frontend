import assert from "node:assert/strict";
import {
  assertChildEnvHasNoProviderSecrets,
  buildI07NonTeacherBackendChildEnv,
  buildI07PythonBootstrapEnv,
  buildI07TeacherBackendChildEnv,
  buildI07ViteChildEnv,
} from "./child_env.mjs";

const SENTINEL = "synthetic-sentinel-must-not-leak";
const polluted = {
  AIEOS_GROQ_API_KEY: SENTINEL,
  OPENAI_API_KEY: SENTINEL,
  GROQ_API_KEY: SENTINEL,
  AZURE_OPENAI_API_KEY: SENTINEL,
  ANTHROPIC_API_KEY: SENTINEL,
  AIEOS_BACKEND_ROOT: "/tmp/fake-backend",
  PATH: "/usr/bin",
};

const vite = buildI07ViteChildEnv("http://127.0.0.1:8024", polluted);
assertChildEnvHasNoProviderSecrets(vite, "vite");
assert.equal(vite.VITE_DEV_API_PROXY_TARGET, "http://127.0.0.1:8024");

const student = buildI07NonTeacherBackendChildEnv(
  "AIEOS360_CX01_I01_SHOWCASE_STUDENT_BACKEND_PORT",
  8025,
  polluted,
);
assertChildEnvHasNoProviderSecrets(student, "student-backend");

const teacher = buildI07TeacherBackendChildEnv(
  "AIEOS360_CX01_I01_SHOWCASE_TEACHER_BACKEND_PORT",
  8024,
  polluted,
);
assertChildEnvHasNoProviderSecrets(teacher, "teacher-backend");

const python = buildI07PythonBootstrapEnv(polluted, {
  AIEOS360_CX01_I01_SHOWCASE_DB_REPORT: "/tmp/db.json",
});
assertChildEnvHasNoProviderSecrets(python, "python-bootstrap");

console.log("child_env.selftest: pass");
