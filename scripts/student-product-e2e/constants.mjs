/** AIEOS360-S01-I04R1 Student real-stack pins (merged I03 backend). */

export const BACKEND_PIN_SHA =
  "921d35eb08890a4e1d86cf95daf9d38cdfc4a13c";

export const OPENAPI_AUTHORITY_SHA =
  "4691D6BADA2157D436435BB5CCDD6797EA670D1A87543D42CA39A478F940F330";

export const EXPECTED_MIGRATION_HEAD = "a360s010002";

/** Synthetic development tenant from backend teacher_os_review_scenario. */
export const DEV_TENANT_ID = "71b5fb49-2bdb-56c3-ab7c-3b33e92a89f0";

/** Opaque development bearer for Student A (not a Principal UUID). */
export const DEV_STUDENT_BEARER_TOKEN = "dev-student-a";

export const DEFAULT_BACKEND_PORT = 8001;
export const DEFAULT_FRONTEND_PORT = 5182;
export const DEFAULT_PG_PORT = 55434;
export const STUDENT_PRODUCT_E2E_CONTAINER = "aieos-student-product-e2e-pg";

export function resolveBackendRoot() {
  const root = process.env.AIEOS_BACKEND_ROOT;
  if (!root) {
    throw new Error(
      "AIEOS_BACKEND_ROOT is required (path to eduvijna-aieos-backend checkout).",
    );
  }
  return root;
}
