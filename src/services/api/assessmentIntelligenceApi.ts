import { apiRequest } from "./client";
import type { components } from "./generated/aieos-v1";

export type TeacherAssessmentIntelligenceResponse =
  components["schemas"]["TeacherAssessmentIntelligenceResponse"];
export type TeacherAssessmentIntelligenceLearnerResponse =
  components["schemas"]["TeacherAssessmentIntelligenceLearnerResponse"];
export type TeacherAssessmentIntelligenceQuestionDistributionResponse =
  components["schemas"]["TeacherAssessmentIntelligenceQuestionDistributionResponse"];
export type TeacherAssessmentIntelligenceFrequentlyMissedResponse =
  components["schemas"]["TeacherAssessmentIntelligenceFrequentlyMissedResponse"];
export type TeacherAssessmentIntelligenceObjectiveRollupResponse =
  components["schemas"]["TeacherAssessmentIntelligenceObjectiveRollupResponse"];

/** Read-only Teacher Assessment Intelligence projection (B3 GET). */
export async function getAssignmentAssessmentIntelligence(
  assignmentId: string,
) {
  return apiRequest<TeacherAssessmentIntelligenceResponse>(
    `/api/v1/assessment/assignments/${assignmentId}/intelligence`,
    { method: "GET" },
  );
}

/**
 * Explicit batch ensure/evaluate for submitted learners under current policy.
 * Returns 204; never call from page-load / GET intelligence paths.
 */
export async function ensureAssignmentEvaluations(
  assignmentId: string,
  idempotencyKey: string,
) {
  return apiRequest<undefined>(
    `/api/v1/assessment/assignments/${assignmentId}/actions/ensure-evaluations`,
    {
      method: "POST",
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    },
  );
}
