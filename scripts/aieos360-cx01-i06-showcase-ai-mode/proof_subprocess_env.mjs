import { PROVIDER_SECRET_ENV_KEYS } from "./constants.mjs";
import { scrubAllProviderSurface, listProviderSecretKeysPresent } from "./env_scrub.mjs";

/** Child-process env for NON-Teacher proof helpers (no provider secret inheritance). */
export function buildProofSubprocessEnv(overrides = {}) {
  return scrubAllProviderSurface({
    ...process.env,
    ...overrides,
  });
}

export function assertNoProviderSecretsInEnv(env) {
  const present = listProviderSecretKeysPresent(env);
  if (present.length > 0) {
    throw new Error(
      `proof subprocess env must not inherit provider secrets: ${present.join(", ")}`,
    );
  }
}

export function providerSecretEnvKeys() {
  return [...PROVIDER_SECRET_ENV_KEYS];
}
