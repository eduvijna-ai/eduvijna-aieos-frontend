import { apiRequest } from "./client";
import type { components } from "./generated/aieos-v1";

export type TeacherOsAssistantRequest =
  components["schemas"]["TeacherOsAssistantRequest"];
export type TeacherOsAssistantResponse =
  components["schemas"]["TeacherOsAssistantResponse"];
export type TeacherOsAssistantHistoryTurn =
  components["schemas"]["TeacherOsAssistantHistoryTurn"];

const ASSISTANT_PATH = "/api/v1/teacher-os/assistant";

export async function respondTeacherOsAssistant(
  body: TeacherOsAssistantRequest,
) {
  return apiRequest<TeacherOsAssistantResponse>(ASSISTANT_PATH, {
    method: "POST",
    body,
  });
}
