import { apiRequest } from "./client";
import type { components } from "./generated/aieos-v1";

export type StudentHomeResponse = components["schemas"]["StudentHomeResponse"];
export type StudentAssignmentListResponse =
  components["schemas"]["StudentAssignmentListResponse"];
export type StudentAssignmentResponse =
  components["schemas"]["StudentAssignmentResponse"];
export type LearnerResourceResponse =
  components["schemas"]["LearnerResourceResponse"];
export type LearnerQuestionResponse =
  components["schemas"]["LearnerQuestionResponse"];
export type AttemptResponse = components["schemas"]["AttemptResponse"];
export type AttemptResponseItemResponse =
  components["schemas"]["AttemptResponseItemResponse"];
export type AttemptResponseWriteRequest =
  components["schemas"]["AttemptResponseWriteRequest"];
export type AttemptResponsesReplaceRequest =
  components["schemas"]["AttemptResponsesReplaceRequest"];

export async function getStudentHome() {
  return apiRequest<StudentHomeResponse>("/api/v1/student-os/home", {
    method: "GET",
  });
}

export async function listStudentAssignments(options?: {
  limit?: number;
  cursor?: string | null;
}) {
  return apiRequest<StudentAssignmentListResponse>(
    "/api/v1/student-os/assignments",
    {
      method: "GET",
      query: {
        limit: options?.limit,
        cursor: options?.cursor ?? undefined,
      },
    },
  );
}

export async function getStudentAssignment(assignmentId: string) {
  return apiRequest<StudentAssignmentResponse>(
    `/api/v1/student-os/assignments/${assignmentId}`,
    { method: "GET" },
  );
}

export async function startLearningAttempt(
  assignmentId: string,
  idempotencyKey: string,
) {
  return apiRequest<AttemptResponse>(
    `/api/v1/learning/assignments/${assignmentId}/attempts`,
    {
      method: "POST",
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    },
  );
}

export async function getLearningAttempt(attemptId: string) {
  return apiRequest<AttemptResponse>(
    `/api/v1/learning/attempts/${attemptId}`,
    { method: "GET" },
  );
}

export async function saveLearningAttemptResponses(
  attemptId: string,
  body: AttemptResponsesReplaceRequest,
  etag: string,
  idempotencyKey: string,
) {
  return apiRequest<AttemptResponse>(
    `/api/v1/learning/attempts/${attemptId}/responses`,
    {
      method: "PUT",
      body,
      headers: {
        "If-Match": etag,
        "Idempotency-Key": idempotencyKey,
      },
    },
  );
}

export async function submitLearningAttempt(
  attemptId: string,
  etag: string,
  idempotencyKey: string,
) {
  return apiRequest<AttemptResponse>(
    `/api/v1/learning/attempts/${attemptId}/actions/submit`,
    {
      method: "POST",
      headers: {
        "If-Match": etag,
        "Idempotency-Key": idempotencyKey,
      },
    },
  );
}
