import type { ParentIntelligenceResponse } from "@/services/api/parentIntelligenceApi";

export const GENERATED_AT = "2026-09-17T12:00:00Z";
export const FIRST_LEARNER = "11111111-1111-4111-8111-111111111111";
export const SECOND_LEARNER = "22222222-2222-4222-8222-222222222222";
export const FIRST_ASSIGNMENT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const SECOND_ASSIGNMENT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const THIRD_ASSIGNMENT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

export function emptyParentHome(): ParentIntelligenceResponse {
  return {
    generated_at: GENERATED_AT,
    projection_mode: "DERIVED_ON_REQUEST",
    time_window: {
      mode: "CURRENT_FACTS_AS_OF_REQUEST",
      start: null,
      end: GENERATED_AT,
    },
    children: [],
  };
}

export function sampleParentHome(): ParentIntelligenceResponse {
  return {
    generated_at: GENERATED_AT,
    projection_mode: "DERIVED_ON_REQUEST",
    time_window: {
      mode: "CURRENT_FACTS_AS_OF_REQUEST",
      start: null,
      end: GENERATED_AT,
    },
    children: [
      {
        learner_principal_id: FIRST_LEARNER,
        assignments: [
          {
            assignment_id: FIRST_ASSIGNMENT,
            title: "Fractions worksheet",
            content_type: "worksheet",
            available_from: "2026-09-16T08:00:00Z",
            due_at: null,
            attempt_status: "NOT_STARTED",
            submitted_at: null,
          },
          {
            assignment_id: SECOND_ASSIGNMENT,
            title: "Place value quiz",
            content_type: "quiz",
            available_from: "2026-09-15T08:00:00Z",
            due_at: "2026-09-20T15:00:00Z",
            attempt_status: "IN_PROGRESS",
            submitted_at: null,
          },
        ],
      },
      {
        learner_principal_id: SECOND_LEARNER,
        assignments: [
          {
            assignment_id: THIRD_ASSIGNMENT,
            title: "Reading homework",
            content_type: "homework",
            available_from: "2026-09-14T08:00:00Z",
            due_at: "2026-09-18T15:00:00Z",
            attempt_status: "SUBMITTED",
            submitted_at: "2026-09-17T09:30:00Z",
          },
        ],
      },
    ],
  };
}

export function sampleParentChild(): ParentIntelligenceResponse {
  const home = sampleParentHome();
  return {
    ...home,
    children: [home.children![1]!],
  };
}
