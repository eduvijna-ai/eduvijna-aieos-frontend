import { apiRequest } from "./client";
import type { components } from "./generated/aieos-v1";

export type WorksheetLearnerHintVersionAppendRequest =
  components["schemas"]["WorksheetLearnerHintVersionAppendRequest"];
export type WorksheetLearnerHintAttestationRecordRequest =
  components["schemas"]["WorksheetLearnerHintAttestationRecordRequest"];
export type WorksheetLearnerHintAttestationRecordResponse =
  components["schemas"]["WorksheetLearnerHintAttestationRecordResponse"];
export type ContentVersionResponse =
  components["schemas"]["ContentVersionResponse"];
export type ReviewSubmissionResponse =
  components["schemas"]["ReviewSubmissionResponse"];

export async function postWorksheetLearnerHintVersionAppend(
  contentId: string,
  body: WorksheetLearnerHintVersionAppendRequest,
  etag: string,
  idempotencyKey: string,
  signal?: AbortSignal,
) {
  return apiRequest<ContentVersionResponse>(
    `/api/v1/contents/${contentId}/worksheet-learner-hint-versions`,
    {
      method: "POST",
      body,
      headers: {
        "If-Match": etag,
        "Idempotency-Key": idempotencyKey,
      },
      signal,
    },
  );
}

export async function postWorksheetLearnerHintAttestation(
  contentId: string,
  versionId: string,
  body: WorksheetLearnerHintAttestationRecordRequest,
  etag: string,
  idempotencyKey: string,
  signal?: AbortSignal,
) {
  return apiRequest<WorksheetLearnerHintAttestationRecordResponse>(
    `/api/v1/contents/${contentId}/versions/${versionId}/actions/record-worksheet-hint-attestation`,
    {
      method: "POST",
      body,
      headers: {
        "If-Match": etag,
        "Idempotency-Key": idempotencyKey,
      },
      signal,
    },
  );
}

export async function postContentSubmitForReview(
  contentId: string,
  versionId: string,
  etag: string,
  idempotencyKey: string,
  signal?: AbortSignal,
) {
  return apiRequest<ReviewSubmissionResponse>(
    `/api/v1/contents/${contentId}/versions/${versionId}/actions/submit-for-review`,
    {
      method: "POST",
      body: {},
      headers: {
        "If-Match": etag,
        "Idempotency-Key": idempotencyKey,
      },
      signal,
    },
  );
}