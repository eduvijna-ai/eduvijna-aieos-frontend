import type {
  PrincipalSchoolIntelligenceClassCardResponse,
  PrincipalSchoolIntelligenceResponse,
} from "@/services/api/principalSchoolIntelligenceApi";

export const GENERATED_AT = "2026-01-15T12:00:00Z";

const DEFAULT_SOURCES = [
  "SCHOOL_CONTEXT",
  "TEACHING_ASSIGNMENT",
  "TEACHING_EXECUTION",
  "LEARNER_SUBMISSION",
  "LEARNER_ASSESSMENT_EVALUATION",
  "CLASSROOM_ASSESSMENT",
  "TEACHING_WORK_REMEDIATION_ORIGIN",
] as const;

export function sampleClassCard(
  overrides?: Partial<PrincipalSchoolIntelligenceClassCardResponse>,
): PrincipalSchoolIntelligenceClassCardResponse {
  return {
    class_ref: "class-6a",
    display_label: "Grade 6A",
    has_assignment_activity: true,
    teaching_assignment_count: 3,
    assignment_lifecycle: { active: 2, closed: 1, cancelled: 0 },
    learner_submission_count: 7,
    current_policy_evaluation_count: 5,
    submitted_but_not_current_policy_evaluated_count: 2,
    evaluation_coverage_among_submitted: {
      submitted_count: 7,
      current_policy_evaluated_count: 5,
    },
    has_recorded_classroom_assessment: true,
    assignments_with_recorded_classroom_assessment_count: 1,
    completed_teaching_execution_count: 2,
    remediation_activity_count: 1,
    ...overrides,
  };
}

export function sampleSchoolIntelligence(
  overrides?: Partial<PrincipalSchoolIntelligenceResponse>,
): PrincipalSchoolIntelligenceResponse {
  const first = sampleClassCard();
  const second = sampleClassCard({
    class_ref: "class-6b",
    display_label: "Grade 6B",
    has_assignment_activity: true,
    teaching_assignment_count: 2,
    assignment_lifecycle: { active: 1, closed: 0, cancelled: 1 },
    learner_submission_count: 3,
    current_policy_evaluation_count: 3,
    submitted_but_not_current_policy_evaluated_count: 0,
    evaluation_coverage_among_submitted: {
      submitted_count: 3,
      current_policy_evaluated_count: 3,
    },
    has_recorded_classroom_assessment: false,
    assignments_with_recorded_classroom_assessment_count: 1,
    completed_teaching_execution_count: 2,
    remediation_activity_count: 0,
  });

  return {
    generated_at: GENERATED_AT,
    projection_mode: "DERIVED_ON_REQUEST",
    time_window: {
      mode: "CURRENT_FACTS_AS_OF_REQUEST",
      start: null,
      end: GENERATED_AT,
    },
    evaluation_policy: {
      policy_id: "aieos.learner_assessment.deterministic",
      policy_version: 1,
    },
    sources: [...DEFAULT_SOURCES],
    summary: {
      in_scope_class_count: 2,
      classes_with_assignment_activity_count: 2,
      teaching_assignment_count: 5,
      assignment_lifecycle: { active: 3, closed: 1, cancelled: 1 },
      learner_submission_count: 10,
      current_policy_evaluation_count: 8,
      submitted_but_not_current_policy_evaluated_count: 2,
      evaluation_coverage_among_submitted: {
        submitted_count: 10,
        current_policy_evaluated_count: 8,
      },
      classes_with_recorded_classroom_assessment_count: 1,
      assignments_with_recorded_classroom_assessment_count: 2,
      completed_teaching_execution_count: 4,
      remediation_activity_count: 1,
    },
    classes: [first, second],
    ...overrides,
  };
}

export function emptyAuthorizedScope(): PrincipalSchoolIntelligenceResponse {
  return sampleSchoolIntelligence({
    summary: {
      in_scope_class_count: 0,
      classes_with_assignment_activity_count: 0,
      teaching_assignment_count: 0,
      assignment_lifecycle: { active: 0, closed: 0, cancelled: 0 },
      learner_submission_count: 0,
      current_policy_evaluation_count: 0,
      submitted_but_not_current_policy_evaluated_count: 0,
      evaluation_coverage_among_submitted: {
        submitted_count: 0,
        current_policy_evaluated_count: 0,
      },
      classes_with_recorded_classroom_assessment_count: 0,
      assignments_with_recorded_classroom_assessment_count: 0,
      completed_teaching_execution_count: 0,
      remediation_activity_count: 0,
    },
    classes: [],
  });
}
