/** AIEOS360-S01-I05-E2E cross-role real-stack pins (ADR-AIEOS-059). */

export const FRONTEND_BASE_SHA =
  "fb5c0f9ae4cb45c8d7876662abdd2e852e318c56";

export const BACKEND_PIN_SHA =
  "3d25bb2d7ae3a6a95affdf075a75f20db48a6959";

export const OPENAPI_AUTHORITY_SHA =
  "7B51CE21725651B8D556B9DD6D264473DF0A2E7CAF30D722E1CC776C651FAFBB";

export const EXPECTED_MIGRATION_HEAD = "a360s010004";

/** Synthetic development tenant/principal from backend teacher_os_review_scenario. */
export const DEV_TENANT_ID = "71b5fb49-2bdb-56c3-ab7c-3b33e92a89f0";
export const DEV_TEACHER_PRINCIPAL_ID = "f85329ab-f05b-564e-a67b-318f3e1f3cf3";
export const DEV_TEACHER_BEARER_TOKEN = "aieos360-i05-e2e-teacher";

/** Opaque development bearer for Student A (not a Principal UUID). */
export const DEV_STUDENT_BEARER_TOKEN = "dev-student-a";

export const DEFAULT_TEACHER_BACKEND_PORT = 8002;
export const DEFAULT_STUDENT_BACKEND_PORT = 8003;
export const DEFAULT_TEACHER_FRONTEND_PORT = 5183;
export const DEFAULT_STUDENT_FRONTEND_PORT = 5184;
export const DEFAULT_PG_PORT = 55435;
export const I05_E2E_CONTAINER = "aieos-aieos360-i05-e2e-pg";

export function resolveBackendRoot() {
  const root = process.env.AIEOS_BACKEND_ROOT;
  if (!root) {
    throw new Error(
      "AIEOS_BACKEND_ROOT is required (path to eduvijna-aieos-backend checkout).",
    );
  }
  return root;
}
