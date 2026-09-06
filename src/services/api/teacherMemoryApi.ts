import { apiRequest } from "./client";
import type { components } from "./generated/aieos-v1";

export type TeacherMemoryCreateRequest =
  components["schemas"]["TeacherMemoryCreateRequest"];
export type TeacherMemoryPreferencesBody =
  components["schemas"]["TeacherMemoryPreferencesBody"];
export type TeacherMemoryResponse =
  components["schemas"]["TeacherMemoryResponse"];
export type TeacherMemoryUpdateRequest =
  components["schemas"]["TeacherMemoryUpdateRequest"];

const MEMORY_PATH = "/api/v1/teacher-os/memory";

export async function getTeacherMemory() {
  return apiRequest<TeacherMemoryResponse>(MEMORY_PATH, { method: "GET" });
}

export async function createTeacherMemory(
  body: TeacherMemoryCreateRequest,
  idempotencyKey: string,
) {
  return apiRequest<TeacherMemoryResponse>(MEMORY_PATH, {
    method: "POST",
    body,
    headers: {
      "Idempotency-Key": idempotencyKey,
    },
  });
}

export async function updateTeacherMemory(
  body: TeacherMemoryUpdateRequest,
  etag: string,
  idempotencyKey: string,
) {
  return apiRequest<TeacherMemoryResponse>(MEMORY_PATH, {
    method: "PUT",
    body,
    headers: {
      "If-Match": etag,
      "Idempotency-Key": idempotencyKey,
    },
  });
}
