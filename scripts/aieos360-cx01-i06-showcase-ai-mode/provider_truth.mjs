import {
  GOVERNED_SYNTHETIC_TENANT_ID,
  MODE_DETERMINISTIC,
  MODE_REAL_AI,
  TENANT_ID_HEADER,
} from "./constants.mjs";

export function buildTeacherProviderAggregatorRequestHeaders() {
  return {
    Accept: "application/json",
    [TENANT_ID_HEADER]: GOVERNED_SYNTHETIC_TENANT_ID,
  };
}

export async function fetchTeacherProviderAggregator(backendBaseUrl, timeoutMs = 15000) {
  const url = `${backendBaseUrl.replace(/\/$/, "")}/api/v1/platform/ai/providers`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: buildTeacherProviderAggregatorRequestHeaders(),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Provider aggregator HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Summarize operator/runtime facts. Provider Aggregator is composition metadata only;
 * real_provider_generation_verified stays false unless separate generation provenance exists.
 */
export function summarizeProviderTruth(
  selectedMode,
  aggregator,
  options = {},
) {
  const generationProven = Boolean(options.generationProvenanceVerified);
  const activeProvider = aggregator?.active_provider_id ?? null;
  const activeModel = aggregator?.active_model_id ?? null;
  const runtimeMode = aggregator?.mode ?? null;
  const runtimeObserved =
    selectedMode === MODE_REAL_AI &&
    runtimeMode === "REAL" &&
    activeProvider !== null &&
    activeProvider !== "fake";

  let verificationState = "runtime_not_active";
  if (selectedMode === MODE_DETERMINISTIC) {
    verificationState = "deterministic_fixture_runtime";
  } else if (runtimeObserved) {
    verificationState = "real_provider_runtime_observed";
  } else if (aggregator) {
    verificationState = "real_ai_runtime_not_verified";
  } else {
    verificationState = "real_ai_selected_runtime_pending";
  }

  return {
    selected_mode: selectedMode,
    verified_runtime_mode:
      selectedMode === MODE_DETERMINISTIC ? MODE_DETERMINISTIC : runtimeMode,
    active_provider_id: activeProvider,
    active_model_id: activeModel,
    aggregator_mode: runtimeMode,
    real_provider_runtime_verified: runtimeObserved,
    real_provider_generation_verified: generationProven,
    live_generation_verification:
      generationProven ? "proven" : "pending_operator_proof",
    verification_state: verificationState,
  };
}
