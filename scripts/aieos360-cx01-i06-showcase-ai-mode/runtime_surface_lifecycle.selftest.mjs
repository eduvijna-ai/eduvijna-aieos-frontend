#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  clearRuntimeSurface,
  writeRuntimeSurface,
} from "./runtime_surface.mjs";
import { resolveShowcaseModeForStart } from "./mode.mjs";

const surfacePath = join(
  mkdtempSync(join(tmpdir(), "cx01-i06-lifecycle-")),
  "runtime.json",
);
process.env.AIEOS360_CX01_I06_RUNTIME_SURFACE_PATH = surfacePath;

writeRuntimeSurface({
  selected_mode: "REAL_AI",
  verified_runtime_mode: "REAL",
  active_provider_id: "groq",
  active_model_id: "openai/gpt-oss-120b",
  verification_state: "real_provider_runtime_observed",
  real_provider_runtime_verified: true,
  real_provider_generation_verified: false,
  live_generation_verification: "pending_operator_proof",
});

clearRuntimeSurface("managed_start_preflight");
let payload = JSON.parse(readFileSync(surfacePath, "utf8"));
assert.equal(payload.runtime_surface_valid, false);
assert.equal(payload.verification_state, "managed_start_preflight");

writeRuntimeSurface({
  selected_mode: "REAL_AI",
  verified_runtime_mode: "REAL",
  active_provider_id: "groq",
  verification_state: "real_provider_runtime_observed",
  real_provider_runtime_verified: true,
});
clearRuntimeSurface("reset_preflight");
payload = JSON.parse(readFileSync(surfacePath, "utf8"));
assert.equal(payload.runtime_surface_valid, false);

writeRuntimeSurface({
  selected_mode: "REAL_AI",
  active_provider_id: "groq",
  real_provider_runtime_verified: true,
});
clearRuntimeSurface("managed_start_failed");
payload = JSON.parse(readFileSync(surfacePath, "utf8"));
assert.equal(payload.runtime_surface_valid, false);

writeRuntimeSurface({
  selected_mode: "REAL_AI",
  active_provider_id: "groq",
  real_provider_runtime_verified: true,
});
clearRuntimeSurface("managed_stop_preflight");
payload = JSON.parse(readFileSync(surfacePath, "utf8"));
assert.equal(payload.runtime_surface_valid, false);

writeRuntimeSurface({
  selected_mode: "REAL_AI",
  active_provider_id: "groq",
  real_provider_runtime_verified: true,
});
clearRuntimeSurface("managed_stop_failed");
payload = JSON.parse(readFileSync(surfacePath, "utf8"));
assert.equal(payload.runtime_surface_valid, false);

writeRuntimeSurface({
  selected_mode: "REAL_AI",
  active_provider_id: "groq",
  real_provider_runtime_verified: true,
});
clearRuntimeSurface("managed_start_preflight");
let threw = false;
try {
  resolveShowcaseModeForStart({
    AIEOS360_CX01_I06_SHOWCASE_MODE: "REAL_AI",
    AIEOS_AI_PROVIDER: "groq",
  });
} catch {
  threw = true;
}
assert.equal(threw, true);
payload = JSON.parse(readFileSync(surfacePath, "utf8"));
assert.equal(payload.runtime_surface_valid, false);

console.log(JSON.stringify({ selftest: "runtime_surface_lifecycle", ok: true }));
