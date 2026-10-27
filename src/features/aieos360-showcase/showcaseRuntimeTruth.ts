export type ShowcaseRuntimeTruth = {
  classification?: string;
  synthetic_rehearsal?: boolean;
  runtime_surface_valid?: boolean;
  selected_mode?: string | null;
  verified_runtime_mode?: string | null;
  active_provider_id?: string | null;
  active_model_id?: string | null;
  verification_state?: string;
  real_provider_runtime_verified?: boolean;
  real_provider_generation_verified?: boolean;
  live_generation_verification?: string;
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
    const payload = (await response.json()) as ShowcaseRuntimeTruth;
    if (payload.runtime_surface_valid === false) {
      return payload;
    }
    return payload;
  } catch {
    return null;
  }
}

export function formatVerificationState(state: string | undefined): string {
  switch (state) {
    case "deterministic_fixture_runtime":
      return "Deterministic fixture runtime (synthetic model activity)";
    case "real_provider_runtime_observed":
      return "REAL_AI — provider runtime composition observed (not generation proof)";
    case "real_ai_runtime_not_verified":
      return "REAL_AI selected — provider runtime not verified";
    case "real_ai_selected_runtime_pending":
      return "REAL_AI selected — runtime verification pending";
    case "runtime_not_active":
    case "managed_stack_stopped":
    case "reset_complete":
    case "managed_start_failed":
      return "Managed showcase not running — runtime truth inactive";
    case "provider_aggregator_unavailable":
      return "Provider Aggregator unavailable";
    default:
      return state ?? "Unknown";
  }
}
