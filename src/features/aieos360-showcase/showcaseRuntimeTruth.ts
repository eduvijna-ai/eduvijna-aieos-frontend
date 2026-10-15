export type ShowcaseRuntimeTruth = {
  classification?: string;
  synthetic_rehearsal?: boolean;
  selected_mode?: string;
  verified_runtime_mode?: string | null;
  active_provider_id?: string | null;
  active_model_id?: string | null;
  verification_state?: string;
  real_provider_generation_verified?: boolean;
  seeded_worksheet_origin?: string;
  operator_control?: string;
};

export const RUNTIME_SURFACE_PATH = "/aieos360-showcase-runtime.json";

export async function loadShowcaseRuntimeTruth(): Promise<ShowcaseRuntimeTruth | null> {
  try {
    const response = await fetch(RUNTIME_SURFACE_PATH, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as ShowcaseRuntimeTruth;
  } catch {
    return null;
  }
}

export function formatVerificationState(state: string | undefined): string {
  switch (state) {
    case "deterministic_fixture_runtime":
      return "Deterministic fixture runtime (synthetic model activity)";
    case "real_provider_runtime_observed":
      return "Real provider runtime observed via Provider Aggregator";
    case "real_ai_selected_not_verified":
      return "REAL_AI selected — live generation not verified on this surface";
    case "provider_aggregator_unavailable":
      return "Provider Aggregator unavailable";
    default:
      return state ?? "Unknown";
  }
}
