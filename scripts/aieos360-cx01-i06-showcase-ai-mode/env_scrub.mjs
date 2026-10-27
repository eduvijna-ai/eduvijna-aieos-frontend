import {
  MODE_DETERMINISTIC,
  MODE_REAL_AI,
  PROVIDER_CONFIG_ENV_KEYS,
  PROVIDER_SECRET_ENV_KEYS,
} from "./constants.mjs";
import { buildCanonicalRealAiOperatorEnv } from "./mode.mjs";

export function scrubProviderSecrets(env) {
  const out = { ...env };
  for (const key of PROVIDER_SECRET_ENV_KEYS) {
    delete out[key];
  }
  return out;
}

export function scrubProviderConfig(env) {
  const out = { ...env };
  for (const key of PROVIDER_CONFIG_ENV_KEYS) {
    delete out[key];
  }
  return out;
}

/** Remove all provider credentials and AI provider selection from child env. */
export function scrubAllProviderSurface(env) {
  return scrubProviderConfig(scrubProviderSecrets(env));
}

export function buildTeacherBackendEnv(baseEnv, showcaseMode, operatorEnv = process.env) {
  const scrubbed = scrubAllProviderSurface(baseEnv);
  scrubbed.AIEOS360_CX01_I06_SHOWCASE_MODE = showcaseMode;
  if (showcaseMode !== MODE_REAL_AI) {
    scrubbed.AIEOS360_CX01_I06_SHOWCASE_RUNTIME_TRUTH = MODE_DETERMINISTIC;
    return scrubbed;
  }
  const canonicalOperator = buildCanonicalRealAiOperatorEnv(operatorEnv);
  const teacherEnv = { ...scrubbed };
  for (const key of PROVIDER_CONFIG_ENV_KEYS) {
    const value = canonicalOperator[key];
    if (value !== undefined && value !== "") {
      teacherEnv[key] = value;
    }
  }
  for (const key of PROVIDER_SECRET_ENV_KEYS) {
    const value = canonicalOperator[key];
    if (value !== undefined && value !== "") {
      teacherEnv[key] = value;
    }
  }
  teacherEnv.AIEOS360_CX01_I06_SHOWCASE_RUNTIME_TRUTH = MODE_REAL_AI;
  return teacherEnv;
}

export function envContainsProviderSecret(env) {
  return PROVIDER_SECRET_ENV_KEYS.some((key) => {
    const value = env[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}

export function listProviderSecretKeysPresent(env) {
  return PROVIDER_SECRET_ENV_KEYS.filter((key) => {
    const value = env[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}
