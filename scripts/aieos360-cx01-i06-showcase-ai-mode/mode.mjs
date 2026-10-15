import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  MODE_DETERMINISTIC,
  MODE_REAL_AI,
  REAL_AI_PROVIDERS,
  SHOWCASE_MODE_ENV,
  SUPPORTED_SHOWCASE_MODES,
} from "./constants.mjs";
import { listProviderSecretKeysPresent } from "./env_scrub.mjs";
import { modeConfigPath } from "./paths.mjs";

export function normalizeShowcaseMode(raw) {
  if (raw === undefined || raw === null) {
    return MODE_DETERMINISTIC;
  }
  const normalized = String(raw).trim().toUpperCase();
  if (!normalized) {
    return MODE_DETERMINISTIC;
  }
  return normalized;
}

export function readSelectedShowcaseMode(env = process.env) {
  return normalizeShowcaseMode(env[SHOWCASE_MODE_ENV]);
}

export function assertValidShowcaseMode(mode) {
  if (!SUPPORTED_SHOWCASE_MODES.has(mode)) {
    throw new Error(
      `AIEOS360-CX01-I06 BLOCKED — invalid ${SHOWCASE_MODE_ENV}=${mode}; ` +
        `expected ${MODE_DETERMINISTIC} or ${MODE_REAL_AI}`,
    );
  }
}

export function validateRealAiOperatorConfig(env = process.env) {
  const provider = String(env.AIEOS_AI_PROVIDER || "")
    .trim()
    .toLowerCase();
  if (!REAL_AI_PROVIDERS.has(provider)) {
    throw new Error(
      "AIEOS360-CX01-I06 BLOCKED — REAL_AI requires AIEOS_AI_PROVIDER=groq or openai",
    );
  }
  const requiredKey =
    provider === "groq" ? "AIEOS_GROQ_API_KEY" : "AIEOS_OPENAI_API_KEY";
  const keyValue = String(env[requiredKey] || "").trim();
  if (!keyValue) {
    throw new Error(
      `AIEOS360-CX01-I06 BLOCKED — REAL_AI requires a non-empty ${requiredKey} in the operator environment`,
    );
  }
  return {
    provider,
    required_key: requiredKey,
    key_present: true,
  };
}

export function resolveShowcaseModeForStart(env = process.env) {
  const mode = readSelectedShowcaseMode(env);
  assertValidShowcaseMode(mode);
  let realAiConfig = null;
  if (mode === MODE_REAL_AI) {
    realAiConfig = validateRealAiOperatorConfig(env);
  } else if (listProviderSecretKeysPresent(env).length > 0) {
    throw new Error(
      "AIEOS360-CX01-I06 BLOCKED — provider API secrets are present but " +
        `${SHOWCASE_MODE_ENV} is not ${MODE_REAL_AI}; remove secrets or select REAL_AI explicitly`,
    );
  }
  return { mode, realAiConfig };
}

export function loadPersistedModeConfig() {
  if (!existsSync(modeConfigPath)) {
    return null;
  }
  return JSON.parse(readFileSync(modeConfigPath, "utf8"));
}

export function persistModeConfig(payload) {
  mkdirSync(dirname(modeConfigPath), { recursive: true });
  writeFileSync(modeConfigPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

export function assertModeChangeAllowed(operatorStatus, registryLiveCount) {
  if (operatorStatus?.phase === "running" || registryLiveCount > 0) {
    throw new Error(
      "AIEOS360-CX01-I06 BLOCKED — showcase mode cannot change while the managed stack is running; stop first",
    );
  }
}

export function buildModeConfigRecord({ mode, realAiConfig }) {
  return {
    selected_mode: mode,
    configured_at: new Date().toISOString(),
    operator_control: "env_before_start",
    real_ai: mode === MODE_REAL_AI
      ? {
          provider: realAiConfig?.provider ?? null,
          required_key: realAiConfig?.required_key ?? null,
          key_present: Boolean(realAiConfig?.key_present),
        }
      : null,
  };
}
