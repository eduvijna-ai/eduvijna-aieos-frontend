import { apiRequest } from "./client";
import type { components } from "./generated/aieos-v1";

export type PrincipalSchoolIntelligenceResponse =
  components["schemas"]["PrincipalSchoolIntelligenceResponse"];
export type PrincipalSchoolIntelligenceSummaryResponse =
  components["schemas"]["PrincipalSchoolIntelligenceSummaryResponse"];
export type PrincipalSchoolIntelligenceClassCardResponse =
  components["schemas"]["PrincipalSchoolIntelligenceClassCardResponse"];
export type AssignmentLifecycleResponse =
  components["schemas"]["AssignmentLifecycleResponse"];
export type EvaluationCoverageAmongSubmittedResponse =
  components["schemas"]["EvaluationCoverageAmongSubmittedResponse"];

const SCHOOL_INTELLIGENCE_PATH =
  "/api/v1/principal-os/school-intelligence";

/** Read-only Principal School Intelligence projection. No client-supplied scope. */
export async function getPrincipalSchoolIntelligence() {
  return apiRequest<PrincipalSchoolIntelligenceResponse>(
    SCHOOL_INTELLIGENCE_PATH,
    { method: "GET" },
  );
}
