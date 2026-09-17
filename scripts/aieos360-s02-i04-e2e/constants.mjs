/** AIEOS360-S02-I04 Principal OS real-stack pins (ADR-AIEOS-060). */

export const FRONTEND_BASE_SHA =
  "4b28e6b499c4593b7d962fe1ed867c2137d43bc7";

export const BACKEND_PIN_SHA =
  "e2bfce86afece6772eaf7c2f1eb18e2dd2240f1b";

export const OPENAPI_AUTHORITY_SHA =
  "BE60CC2A4612F77AB333088D264B9501B9AB842995AEC1539DA89EA0E8462B47";

export const EXPECTED_MIGRATION_HEAD = "a360s010004";

/** Synthetic development tenant from backend teacher_os_review_scenario. */
export const DEV_TENANT_ID = "71b5fb49-2bdb-56c3-ab7c-3b33e92a89f0";
export const DEV_TEACHER_PRINCIPAL_ID = "f85329ab-f05b-564e-a67b-318f3e1f3cf3";
export const DEV_TEACHER_BEARER_TOKEN = "aieos360-s02-i04-e2e-teacher";

/** Opaque development bearer for Student A (not a Principal UUID). */
export const DEV_STUDENT_BEARER_TOKEN = "dev-student-a";

/** Opaque I04 Principal DEV bearer. Transport only — not PrincipalId. */
export const DEV_PRINCIPAL_BEARER_TOKEN = "aieos360-s02-i04-e2e-principal";

export const DEFAULT_TEACHER_BACKEND_PORT = 8004;
export const DEFAULT_STUDENT_BACKEND_PORT = 8005;
export const DEFAULT_PRINCIPAL_BACKEND_PORT = 8006;
export const DEFAULT_TEACHER_FRONTEND_PORT = 5185;
export const DEFAULT_STUDENT_FRONTEND_PORT = 5186;
export const DEFAULT_PRINCIPAL_FRONTEND_PORT = 5187;
export const DEFAULT_PG_PORT = 55436;
export const I04_E2E_CONTAINER = "aieos-aieos360-s02-i04-e2e-pg";

export function resolveBackendRoot() {
  const root = process.env.AIEOS_BACKEND_ROOT;
  if (!root) {
    throw new Error(
      "AIEOS_BACKEND_ROOT is required (path to eduvijna-aieos-backend checkout).",
    );
  }
  return root;
}
