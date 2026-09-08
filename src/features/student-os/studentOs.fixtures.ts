import type {
  AttemptResponse,
  StudentAssignmentResponse,
  StudentHomeResponse,
} from "@/services/api/studentLearningApi";

export const ASSIGNMENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const ATTEMPT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const CONTENT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
export const CONTENT_VERSION_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

export function sampleLearnerResource(
  overrides?: Partial<NonNullable<StudentAssignmentResponse["resource"]>>,
): NonNullable<StudentAssignmentResponse["resource"]> {
  return {
    content_id: CONTENT_ID,
    content_version_id: CONTENT_VERSION_ID,
    content_type: "worksheet",
    schema_id: "education.worksheet",
    schema_version: 1,
    title: "Leaf parts worksheet",
    learning_objectives: [{ id: "obj-1", text: "Name one part of a leaf." }],
    instructions: "Answer every question you can.",
    questions: [
      {
        id: "q-tf",
        prompt: "A leaf has veins.",
        question_type: "TRUE_FALSE",
        options: [],
      },
      {
        id: "q-mc",
        prompt: "Which part makes food?",
        question_type: "MULTIPLE_CHOICE",
        options: ["Root", "Leaf"],
      },
      {
        id: "q-sa",
        prompt: "Name one part of a leaf.",
        question_type: "SHORT_ANSWER",
        options: [],
      },
    ],
    ...overrides,
  };
}

export function sampleAssignment(
  overrides?: Partial<StudentAssignmentResponse>,
): StudentAssignmentResponse {
  return {
    assignment_id: ASSIGNMENT_ID,
    class_ref: "grade-5-science",
    available_from: "2026-09-01T00:00:00Z",
    due_at: "2026-09-10T15:00:00Z",
    lifecycle_state: "ACTIVE",
    currently_consumable: true,
    content_id: CONTENT_ID,
    content_version_id: CONTENT_VERSION_ID,
    attempt_summary: "NOT_STARTED",
    attempt_id: null,
    resource: sampleLearnerResource(),
    ...overrides,
  };
}

export function sampleHome(
  overrides?: Partial<StudentHomeResponse>,
): StudentHomeResponse {
  return {
    current_assignment_count: 1,
    items: [sampleAssignment()],
    ...overrides,
  };
}

export function sampleAttempt(
  overrides?: Partial<AttemptResponse>,
): AttemptResponse {
  return {
    attempt_id: ATTEMPT_ID,
    teaching_assignment_id: ASSIGNMENT_ID,
    content_id: CONTENT_ID,
    content_version_id: CONTENT_VERSION_ID,
    class_ref: "grade-5-science",
    attempt_number: 1,
    lifecycle_state: "IN_PROGRESS",
    started_at: "2026-09-08T10:00:00Z",
    last_saved_at: null,
    submitted_at: null,
    submission_id: null,
    aggregate_revision: 0,
    responses: [],
    ...overrides,
  };
}
