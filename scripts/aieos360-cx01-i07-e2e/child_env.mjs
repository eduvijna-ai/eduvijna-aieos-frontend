/**
 * CX01-I07 E2E child-process env — I06 provider isolation (deterministic proof only).
 */
import { MODE_DETERMINISTIC } from "../aieos360-cx01-i06-showcase-ai-mode/constants.mjs";
import {
  buildTeacherBackendEnv,
  envContainsProviderSecret,
  listProviderSecretKeysPresent,
  scrubAllProviderSurface,
} from "../aieos360-cx01-i06-showcase-ai-mode/env_scrub.mjs";
import { buildProofSubprocessEnv } from "../aieos360-cx01-i06-showcase-ai-mode/proof_subprocess_env.mjs";

const PASSTHROUGH_KEYS = [
  "PATH",
  "HOME",
  "USER",
  "LANG",
  "LC_ALL",
  "TMPDIR",
  "TEMP",
  "TMP",
  "NODE_ENV",
  "CI",
  "PNPM_HOME",
  "UV",
  "AIEOS_BACKEND_ROOT",
  "AIEOS360_CX01_I07_E2E_UV",
  "AIEOS360_CX01_I01_SHOWCASE_UV",
  "AIEOS_TEST_BOOTSTRAP_DATABASE_URL",
  "AIEOS_TEST_DATABASE_URL",
  "AIEOS_TEST_RUNTIME_DATABASE_URL",
  "AIEOS360_CX01_I07_E2E_RUNTIME_DATABASE_URL",
  "AIEOS360_CX01_I07_E2E_SKIP_BOOTSTRAP",
  "AIEOS360_CX01_I07_REHEARSE_MANAGED_STACK",
  "AIEOS360_CX01_I07_REHEARSE_CI",
  "AIEOS360_CX01_I01_SHOWCASE_CI_EXTERNAL_PG",
  "AIEOS360_CX01_I01_SHOWCASE_DB_REPORT",
  "AIEOS360_CX01_I01_SHOWCASE_FIXTURE_PATH",
  "AIEOS360_CX01_I01_SHOWCASE_RUNTIME_DATABASE_URL",
  "AIEOS360_CX01_I01_SHOWCASE_BOOTSTRAP_DATABASE_URL",
  "AIEOS360_CX01_I01_SHOWCASE_TEACHER_BACKEND_PORT",
  "AIEOS360_CX01_I01_SHOWCASE_STUDENT_BACKEND_PORT",
  "AIEOS360_CX01_I01_SHOWCASE_PRINCIPAL_BACKEND_PORT",
  "AIEOS360_CX01_I01_SHOWCASE_PARENT_BACKEND_PORT",
  "AIEOS360_CX01_I07_E2E_TEACHER_BACKEND_PORT",
  "AIEOS360_CX01_I07_E2E_STUDENT_BACKEND_PORT",
  "AIEOS360_CX01_I07_E2E_PRINCIPAL_BACKEND_PORT",
  "AIEOS360_CX01_I07_E2E_PARENT_BACKEND_PORT",
  "AIEOS360_CX01_I07_E2E_TEACHER_FRONTEND_PORT",
  "AIEOS360_CX01_I07_E2E_STUDENT_FRONTEND_PORT",
  "AIEOS360_CX01_I07_E2E_PRINCIPAL_FRONTEND_PORT",
  "AIEOS360_CX01_I07_E2E_PARENT_FRONTEND_PORT",
  "AIEOS360_CX01_I07_E2E_FIXTURE_PATH",
  "AIEOS360_CX01_I07_E2E_DB_REPORT",
  "AIEOS360_S04_I03_E2E_DB_REPORT",
  "AIEOS360_I05_E2E_DB_REPORT",
  "PYTHONPATH",
];

function pickPassthrough(source) {
  const out = {};
  for (const key of PASSTHROUGH_KEYS) {
    const value = source[key];
    if (value !== undefined && value !== "") {
      out[key] = value;
    }
  }
  return out;
}

export function assertI07DeterministicProofPolicy(operatorEnv = process.env) {
  const mode = String(
    operatorEnv.AIEOS360_CX01_I06_SHOWCASE_MODE || MODE_DETERMINISTIC,
  )
    .trim()
    .toUpperCase();
  if (mode !== MODE_DETERMINISTIC) {
    throw new Error(
      `CX01-I07 integrated proof requires DETERMINISTIC mode; got ${mode}`,
    );
  }
}

export function buildI07ViteChildEnv(backendUrl, operatorEnv = process.env) {
  assertI07DeterministicProofPolicy(operatorEnv);
  return scrubAllProviderSurface({
    ...pickPassthrough(operatorEnv),
    VITE_DEV_API_PROXY_TARGET: backendUrl,
    AIEOS360_CX01_I06_SHOWCASE_MODE: MODE_DETERMINISTIC,
    AIEOS360_CX01_I06_SHOWCASE_RUNTIME_TRUTH: MODE_DETERMINISTIC,
  });
}

export function buildI07NonTeacherBackendChildEnv(
  portEnvKey,
  port,
  operatorEnv = process.env,
  extra = {},
) {
  assertI07DeterministicProofPolicy(operatorEnv);
  return scrubAllProviderSurface({
    ...pickPassthrough(operatorEnv),
    ...extra,
    [portEnvKey]: String(port),
    AIEOS360_CX01_I06_SHOWCASE_MODE: MODE_DETERMINISTIC,
    AIEOS360_CX01_I06_SHOWCASE_RUNTIME_TRUTH: MODE_DETERMINISTIC,
  });
}

export function buildI07TeacherBackendChildEnv(
  portEnvKey,
  port,
  operatorEnv = process.env,
  extra = {},
) {
  assertI07DeterministicProofPolicy(operatorEnv);
  const base = scrubAllProviderSurface({
    ...pickPassthrough(operatorEnv),
    ...extra,
    [portEnvKey]: String(port),
  });
  return buildTeacherBackendEnv(base, MODE_DETERMINISTIC, operatorEnv);
}

export function buildI07PythonBootstrapEnv(operatorEnv = process.env, extra = {}) {
  assertI07DeterministicProofPolicy(operatorEnv);
  return buildProofSubprocessEnv({
    ...pickPassthrough(operatorEnv),
    ...extra,
  });
}

export function assertChildEnvHasNoProviderSecrets(env, label) {
  if (envContainsProviderSecret(env)) {
    const keys = listProviderSecretKeysPresent(env);
    throw new Error(
      `CX01-I07 child env ${label} must not inherit provider secrets: ${keys.join(", ")}`,
    );
  }
}
