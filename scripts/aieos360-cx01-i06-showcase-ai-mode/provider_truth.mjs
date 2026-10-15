import { MODE_DETERMINISTIC, MODE_REAL_AI } from "./constants.mjs";

export async function fetchTeacherProviderAggregator(backendBaseUrl, timeoutMs = 15000) {
  const url = `${backendBaseUrl.replace(/\/$/, "")}/api/v1/platform/ai/providers`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
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

export function summarizeProviderTruth(selectedMode, aggregator) {
  const activeProvider = aggregator?.active_provider_id ?? null;
  const activeModel = aggregator?.active_model_id ?? null;
  const runtimeMode = aggregator?.mode ?? null;
  const verifiedReal =
    selectedMode === MODE_REAL_AI &&
    runtimeMode === "REAL" &&
    activeProvider !== null &&
    activeProvider !== "fake";
  return {
    selected_mode: selectedMode,
    verified_runtime_mode:
      selectedMode === MODE_DETERMINISTIC ? MODE_DETERMINISTIC : runtimeMode,
    active_provider_id: activeProvider,
    active_model_id: activeModel,
    aggregator_mode: runtimeMode,
    real_provider_generation_verified: verifiedReal,
    verification_state:
      selectedMode === MODE_DETERMINISTIC
        ? "deterministic_fixture_runtime"
        : verifiedReal
          ? "real_provider_runtime_observed"
          : "real_ai_selected_not_verified",
  };
}
