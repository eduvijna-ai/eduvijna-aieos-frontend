import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { runtimeSurfacePath } from "./paths.mjs";

function resolveRuntimeSurfacePath() {
  const override = process.env.AIEOS360_CX01_I06_RUNTIME_SURFACE_PATH;
  return override || runtimeSurfacePath;
}

export function inactiveRuntimeSurfacePayload(reason = "runtime_not_active") {
  return {
    classification: "NON_PRODUCTION",
    synthetic_rehearsal: true,
    runtime_surface_valid: false,
    selected_mode: null,
    verified_runtime_mode: null,
    active_provider_id: null,
    active_model_id: null,
    real_provider_runtime_verified: false,
    real_provider_generation_verified: false,
    live_generation_verification: "pending_operator_proof",
    verification_state: reason,
    seeded_worksheet_origin: "synthetic_prerequisite_fixture",
    operator_control: "env_before_start",
  };
}

export function writeRuntimeSurface(payload) {
  const path = resolveRuntimeSurfacePath();
  mkdirSync(dirname(path), { recursive: true });
  const sanitized = {
    classification: "NON_PRODUCTION",
    synthetic_rehearsal: true,
    runtime_surface_valid: true,
    ...payload,
    real_provider_generation_verified:
      payload.real_provider_generation_verified === true,
  };
  writeFileSync(path, JSON.stringify(sanitized, null, 2) + "\n", "utf8");
  return path;
}

export function clearRuntimeSurface(reason = "runtime_not_active") {
  const path = resolveRuntimeSurfacePath();
  writeRuntimeSurface(inactiveRuntimeSurfacePayload(reason));
  return path;
}

export function runtimeSurfaceExists() {
  return existsSync(resolveRuntimeSurfacePath());
}
