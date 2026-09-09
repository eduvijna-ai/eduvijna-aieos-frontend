import { describe, expect, it } from "vitest";
import {
  isCurrentlyEvaluatedState,
  needsCurrentPolicyEvaluation,
  totalUnansweredAmongSubmitted,
} from "./intelligencePresentation";
import type { TeacherAssessmentIntelligenceResponse } from "@/services/api/assessmentIntelligenceApi";

function sampleIntelligence(
  overrides?: Partial<TeacherAssessmentIntelligenceResponse>,
): TeacherAssessmentIntelligenceResponse {
  return {
    teaching_assignment_id: "aaaaaaaa-aaaa-7aaa-aaaa-aaaaaaaaaaaa",
    class_ref: "class-5a",
    content_id: "11111111-1111-7111-8111-111111111111",
    content_version_id: "22222222-2222-7222-8222-222222222222",
    evaluation_policy_id: "aieos.learner_assessment.deterministic",
    evaluation_policy_version: 1,
    submitted_learner_count: 2,
    evaluated_learner_count: 1,
    learners: [
      {
        learner_principal_id: "bbbbbbbb-bbbb-7bbb-bbbb-bbbbbbbbbbbb",
        submission_id: "cccccccc-cccc-7ccc-cccc-cccccccccccc",
        evaluation_state: "EVALUATED_UNDER_CURRENT_POLICY",
        evaluation_id: "dddddddd-dddd-7ddd-dddd-dddddddddddd",
        evaluated_at: "2026-09-09T10:00:00Z",
        evaluation_policy_id: "aieos.learner_assessment.deterministic",
        evaluation_policy_version: 1,
        items: [],
        objective_evidence: [],
      },
      {
        learner_principal_id: "eeeeeeee-eeee-7eee-eeee-eeeeeeeeeeee",
        submission_id: "ffffffff-ffff-7fff-ffff-ffffffffffff",
        evaluation_state: "NOT_EVALUATED",
        evaluation_id: null,
        evaluated_at: null,
        evaluation_policy_id: null,
        evaluation_policy_version: null,
        items: [],
        objective_evidence: [],
      },
    ],
    question_distributions: [
      {
        question_id: "q1",
        correct: 1,
        incorrect: 0,
        unanswered: 2,
        open_response_unevaluated: 0,
        unevaluated_policy_reject: 0,
      },
    ],
    frequently_missed_questions: [],
    objective_evidence_rollups: [],
    ...overrides,
  };
}

describe("AIEOS360-S01-I05-F1 intelligence presentation", () => {
  it("sums unanswered without treating it as incorrect/missed", () => {
    expect(
      totalUnansweredAmongSubmitted(
        sampleIntelligence().question_distributions,
      ),
    ).toBe(2);
  });

  it("does not treat NOT_EVALUATED_UNDER_CURRENT_POLICY as currently evaluated", () => {
    expect(isCurrentlyEvaluatedState("EVALUATED_UNDER_CURRENT_POLICY")).toBe(
      true,
    );
    expect(
      isCurrentlyEvaluatedState("NOT_EVALUATED_UNDER_CURRENT_POLICY"),
    ).toBe(false);
    expect(isCurrentlyEvaluatedState("NOT_EVALUATED")).toBe(false);
  });

  it("detects when explicit ensure is needed", () => {
    expect(needsCurrentPolicyEvaluation(sampleIntelligence())).toBe(true);
    expect(
      needsCurrentPolicyEvaluation(
        sampleIntelligence({
          submitted_learner_count: 0,
          evaluated_learner_count: 0,
          learners: [],
        }),
      ),
    ).toBe(false);
    expect(
      needsCurrentPolicyEvaluation(
        sampleIntelligence({
          evaluated_learner_count: 2,
          learners: [
            {
              ...sampleIntelligence().learners[0]!,
              evaluation_state: "EVALUATED_UNDER_CURRENT_POLICY",
            },
            {
              ...sampleIntelligence().learners[0]!,
              learner_principal_id: "eeeeeeee-eeee-7eee-eeee-eeeeeeeeeeee",
              submission_id: "ffffffff-ffff-7fff-ffff-ffffffffffff",
              evaluation_state: "EVALUATED_UNDER_CURRENT_POLICY",
            },
          ],
        }),
      ),
    ).toBe(false);
  });
});
