/** PK-V1-HINT-E2E-I01 real-stack learner-hint vertical pins (ADR-AIEOS-063). */

export const ARCHITECTURE_PIN_SHA =
  "3c0a66aa0a06835e12bb6eeb0da64b7fe147999f";

export const FRONTEND_BASE_SHA =
  "e3a6b4a307edf359a00e027fd50f872751934f5b";

export const BACKEND_PIN_SHA =
  "5bbc09bc895407b71a61f9ba86a7209ff9c10ffa";

export const OPENAPI_AUTHORITY_SHA =
  "0061BCF6065FAFA184F196829A87AF98ADEDFCE6B633D45704141A5B48045D22";

export const EXPECTED_MIGRATION_HEAD = "a360s010005";

export const DEV_TENANT_ID = "71b5fb49-2bdb-56c3-ab7c-3b33e92a89f0";

/** Three distinct HUMAN teacher-role principals (opaque bearer aliases in fixture). */
export const DEV_AUTHOR_BEARER_TOKEN = "pk-v1-hint-e2e-author";
export const DEV_REVIEWER_BEARER_TOKEN = "pk-v1-hint-e2e-reviewer";
export const DEV_PUBLISHER_BEARER_TOKEN = "pk-v1-hint-e2e-publisher";

export const DEV_STUDENT_BEARER_TOKEN = "dev-student-a";

export const DEFAULT_TEACHER_BACKEND_PORT = 8028;
export const DEFAULT_STUDENT_BACKEND_PORT = 8029;
export const DEFAULT_TEACHER_FRONTEND_PORT = 5191;
export const DEFAULT_STUDENT_FRONTEND_PORT = 5192;
export const DEFAULT_PG_PORT = 55439;
export const DEFAULT_PROBE_PG_PORT = 55440;
export const PK_V1_HINT_E2E_CONTAINER = "aieos-pk-v1-hint-e2e-pg";
export const PK_V1_HINT_E2E_PROBE_CONTAINER = "aieos-pk-v1-hint-e2e-pg-probe";

export function resolveBackendRoot() {
  const root = process.env.AIEOS_BACKEND_ROOT;
  if (!root) {
    throw new Error(
      "AIEOS_BACKEND_ROOT is required (path to eduvijna-aieos-backend checkout).",
    );
  }
  return root;
}