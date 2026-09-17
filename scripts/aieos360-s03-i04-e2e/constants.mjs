/** AIEOS360-S03-I04 Parent OS real-stack pins (ADR-AIEOS-061). */

export const ARCHITECTURE_PIN_SHA =
  "67f4020b78cacdf1716e18d83f4410cb16fdcb4d";

export const FRONTEND_BASE_SHA =
  "04c2b1850732df1b8fe5de55f018edf30365181d";

export const BACKEND_PIN_SHA =
  "138f37bfa7a44c33b206c6b78118154bbb9bc8eb";

export const OPENAPI_AUTHORITY_SHA =
  "4042FB2725DA70A02A70EE09563B7698AE2E5DA82927614CAF1B5F7E6AA7C1D0";

export const EXPECTED_MIGRATION_HEAD = "a360s010004";

/** Synthetic development tenant from backend teacher_os_review_scenario. */
export const DEV_TENANT_ID = "71b5fb49-2bdb-56c3-ab7c-3b33e92a89f0";
export const DEV_TEACHER_PRINCIPAL_ID = "f85329ab-f05b-564e-a67b-318f3e1f3cf3";
export const DEV_TEACHER_BEARER_TOKEN = "aieos360-s03-i04-e2e-teacher";

/** Opaque development bearer for Student A (not a Principal UUID). */
export const DEV_STUDENT_BEARER_TOKEN = "dev-student-a";

/** Opaque I04 Parent DEV bearer. Transport only — not PrincipalId. */
export const DEV_PARENT_BEARER_TOKEN = "aieos360-s03-i04-e2e-parent";

export const DEFAULT_TEACHER_BACKEND_PORT = 8007;
export const DEFAULT_STUDENT_BACKEND_PORT = 8008;
export const DEFAULT_PARENT_BACKEND_PORT = 8009;
export const DEFAULT_TEACHER_FRONTEND_PORT = 5188;
export const DEFAULT_STUDENT_FRONTEND_PORT = 5189;
export const DEFAULT_PARENT_FRONTEND_PORT = 5190;
export const DEFAULT_PG_PORT = 55437;
export const I04_E2E_CONTAINER = "aieos-aieos360-s03-i04-e2e-pg";

export function resolveBackendRoot() {
  const root = process.env.AIEOS_BACKEND_ROOT;
  if (!root) {
    throw new Error(
      "AIEOS_BACKEND_ROOT is required (path to eduvijna-aieos-backend checkout).",
    );
  }
  return root;
}
