import type {
  TeacherAssessmentIntelligenceLearnerResponse,
  TeacherAssessmentIntelligenceObjectiveRollupResponse,
  TeacherAssessmentIntelligenceQuestionDistributionResponse,
  TeacherAssessmentIntelligenceResponse,
} from "@/services/api/assessmentIntelligenceApi";

/** Exact backend evaluation_state wire values. */
export const LEARNER_EVALUATION_STATES = [
  "NOT_EVALUATED",
  "EVALUATED_UNDER_CURRENT_POLICY",
  "NOT_EVALUATED_UNDER_CURRENT_POLICY",
] as const;

export type LearnerEvaluationState =
  (typeof LEARNER_EVALUATION_STATES)[number];

export const LEARNER_EVALUATION_STATE_LABELS: Record<
  LearnerEvaluationState,
  string
> = {
  NOT_EVALUATED: "Not evaluated",
  EVALUATED_UNDER_CURRENT_POLICY: "Evaluated under current policy",
  NOT_EVALUATED_UNDER_CURRENT_POLICY:
    "Not evaluated under current policy (historical)",
};

export const ITEM_OUTCOME_LABELS = {
  CORRECT: "Correct",
  INCORRECT: "Incorrect",
  UNANSWERED: "Unanswered",
  OPEN_RESPONSE_UNEVALUATED: "Open response — unevaluated",
  UNEVALUATED_POLICY_REJECT: "Unevaluated — policy reject",
} as const;

export const OBJECTIVE_EVIDENCE_LABELS = {
  INSUFFICIENT_EVIDENCE: "Insufficient evidence",
  DEMONSTRATED_ON_SUBMITTED_ITEMS: "Demonstrated on submitted items",
  MIXED_ON_SUBMITTED_ITEMS: "Mixed on submitted items",
  NOT_YET_DEMONSTRATED_ON_SUBMITTED_ITEMS:
    "Not yet demonstrated on submitted items",
} as const;

export function formatLearnerEvaluationStateLabel(state: string): string {
  if (state in LEARNER_EVALUATION_STATE_LABELS) {
    return LEARNER_EVALUATION_STATE_LABELS[state as LearnerEvaluationState];
  }
  return state;
}

export function isCurrentlyEvaluatedState(state: string): boolean {
  return state === "EVALUATED_UNDER_CURRENT_POLICY";
}

/** Sum of UNANSWERED item outcomes across question distributions (not “missed”). */
export function totalUnansweredAmongSubmitted(
  distributions: TeacherAssessmentIntelligenceQuestionDistributionResponse[],
): number {
  return distributions.reduce((sum, row) => sum + row.unanswered, 0);
}

export function needsCurrentPolicyEvaluation(
  intelligence: TeacherAssessmentIntelligenceResponse,
): boolean {
  if (intelligence.submitted_learner_count === 0) return false;
  return intelligence.learners.some(
    (learner) =>
      learner.evaluation_state === "NOT_EVALUATED" ||
      learner.evaluation_state === "NOT_EVALUATED_UNDER_CURRENT_POLICY",
  );
}

export function shortPrincipalId(principalId: string): string {
  if (principalId.length <= 12) return principalId;
  return `${principalId.slice(0, 8)}…`;
}

/** Presentation-only: never invent mastery/score claims from these counts. */
export function intelligenceSummaryCopy(
  intelligence: TeacherAssessmentIntelligenceResponse,
): string {
  return (
    `${intelligence.submitted_learner_count} submitted · ` +
    `${intelligence.evaluated_learner_count} evaluated under current policy. ` +
    `Evidence only — not a class score, not mastery, not ClassroomAssessment.`
  );
}

export function objectiveRollupRows(
  rollups: TeacherAssessmentIntelligenceObjectiveRollupResponse[],
) {
  return rollups.map((row) => ({
    objectiveId: row.objective_id,
    insufficientEvidence: row.insufficient_evidence,
    demonstrated: row.demonstrated_on_submitted_items,
    mixed: row.mixed_on_submitted_items,
    notYet: row.not_yet_demonstrated_on_submitted_items,
  }));
}

export function learnerRows(
  learners: TeacherAssessmentIntelligenceLearnerResponse[],
) {
  return learners.map((learner) => ({
    learnerPrincipalId: learner.learner_principal_id,
    submissionId: learner.submission_id,
    evaluationState: learner.evaluation_state,
    evaluationStateLabel: formatLearnerEvaluationStateLabel(
      learner.evaluation_state,
    ),
    currentlyEvaluated: isCurrentlyEvaluatedState(learner.evaluation_state),
    evaluationId: learner.evaluation_id ?? null,
  }));
}
