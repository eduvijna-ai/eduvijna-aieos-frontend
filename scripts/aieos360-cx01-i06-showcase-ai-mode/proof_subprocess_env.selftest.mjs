#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  assertNoProviderSecretsInEnv,
  buildProofSubprocessEnv,
  providerSecretEnvKeys,
} from "./proof_subprocess_env.mjs";

const sentinel = "synthetic-sentinel-must-not-leak";
for (const key of providerSecretEnvKeys()) {
  process.env[key] = sentinel;
}
const scrubbed = buildProofSubprocessEnv({ AIEOS_BACKEND_ROOT: "/tmp/fake-backend" });
assertNoProviderSecretsInEnv(scrubbed);
for (const key of providerSecretEnvKeys()) {
  assert.equal(scrubbed[key], undefined);
}

console.log(JSON.stringify({ selftest: "proof_subprocess_env", ok: true }));
