import { apiRequest } from "./client";
import type { components } from "./generated/aieos-v1";

export type ParentIntelligenceResponse =
  components["schemas"]["ParentIntelligenceResponse"];
export type ParentChildCardResponse =
  components["schemas"]["ParentChildCardResponse"];
export type ParentAssignmentStatusResponse =
  components["schemas"]["ParentAssignmentStatusResponse"];
export type ParentIntelligenceTimeWindowResponse =
  components["schemas"]["ParentIntelligenceTimeWindowResponse"];

export const PARENT_OS_HOME_PATH = "/api/v1/parent-os/home";

export function parentOsChildPath(learnerPrincipalId: string): string {
  return `/api/v1/parent-os/children/${encodeURIComponent(learnerPrincipalId)}`;
}

/** Read-only Parent Intelligence home. No client-supplied access proof. */
export async function getParentOsHome() {
  return apiRequest<ParentIntelligenceResponse>(PARENT_OS_HOME_PATH, {
    method: "GET",
  });
}

/** Read-only Parent Intelligence child selector. The UUID is a selector only. */
export async function getParentOsChild(learnerPrincipalId: string) {
  return apiRequest<ParentIntelligenceResponse>(
    parentOsChildPath(learnerPrincipalId),
    { method: "GET" },
  );
}
