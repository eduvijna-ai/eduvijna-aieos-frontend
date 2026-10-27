#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  buildTeacherBackendEnv,
  envContainsProviderSecret,
  scrubAllProviderSurface,
} from "./env_scrub.mjs";
import {
  MODE_DETERMINISTIC,
  MODE_REAL_AI,
  SHOWCASE_MODE_ENV,
} from "./constants.mjs";
import {
  assertValidShowcaseMode,
  normalizeShowcaseMode,
  readSelectedShowcaseMode,
  resolveShowcaseModeForStart,
  validateRealAiOperatorConfig,
} from "./mode.mjs";
import {
  buildTeacherProviderAggregatorRequestHeaders,
  summarizeProviderTruth,
} from "./provider_truth.mjs";

function expectThrows(fn, pattern) {
  let thrown = null;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown, "expected throw");
  if (pattern) {
    assert.match(String(thrown), pattern);
  }
}

assert.equal(normalizeShowcaseMode(undefined), MODE_DETERMINISTIC);
assert.equal(normalizeShowcaseMode(""), MODE_DETERMINISTIC);
assert.equal(normalizeShowcaseMode("real_ai"), MODE_REAL_AI);
expectThrows(() => assertValidShowcaseMode("LIVE"), /invalid/);

const operator = {
  [SHOWCASE_MODE_ENV]: MODE_REAL_AI,
  AIEOS_AI_PROVIDER: "groq",
  AIEOS_GROQ_API_KEY: "synthetic-test-key",
};
const teacherEnv = buildTeacherBackendEnv({ FOO: "1" }, MODE_REAL_AI, operator);
assert.equal(teacherEnv.AIEOS_GROQ_API_KEY, "synthetic-test-key");
assert.equal(teacherEnv.FOO, "1");

const studentEnv = scrubAllProviderSurface({
  ...operator,
  FOO: "1",
});
assert.equal(studentEnv.AIEOS_GROQ_API_KEY, undefined);
assert.equal(envContainsProviderSecret(studentEnv), false);

expectThrows(
  () =>
    resolveShowcaseModeForStart({
      [SHOWCASE_MODE_ENV]: MODE_DETERMINISTIC,
      AIEOS_GROQ_API_KEY: "secret",
    }),
  /provider API secrets/,
);

expectThrows(
  () =>
    validateRealAiOperatorConfig({
      AIEOS_AI_PROVIDER: "groq",
    }),
  /AIEOS_GROQ_API_KEY/,
);

assert.equal(readSelectedShowcaseMode({}), MODE_DETERMINISTIC);

const compositionOnly = summarizeProviderTruth(MODE_REAL_AI, {
  active_provider_id: "groq",
  active_model_id: "openai/gpt-oss-120b",
  mode: "REAL",
});
assert.equal(compositionOnly.real_provider_generation_verified, false);
assert.equal(compositionOnly.real_provider_runtime_verified, true);

assert.equal(
  buildTeacherProviderAggregatorRequestHeaders()["X-AIEOS-Tenant-ID"],
  "71b5fb49-2bdb-56c3-ab7c-3b33e92a89f0",
);

console.log(JSON.stringify({ selftest: "i06_mode", ok: true }));
