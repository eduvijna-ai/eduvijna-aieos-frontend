import { apiRequest } from "./client";
import type { components } from "./generated/aieos-v1";

export type ProviderAggregatorResponse =
  components["schemas"]["ProviderAggregatorResponse"];
export type ProviderCandidateResponse =
  components["schemas"]["ProviderCandidateResponse"];
export type CapabilityRouteResponse =
  components["schemas"]["CapabilityRouteResponse"];

const PROVIDERS_PATH = "/api/v1/platform/ai/providers";

export async function getProviderAggregator() {
  return apiRequest<ProviderAggregatorResponse>(PROVIDERS_PATH, {
    method: "GET",
  });
}
