/** AIEOS360-S04-I03 integrated cross-role real-stack pins (ADR-AIEOS-062). */

export const ARCHITECTURE_PIN_SHA =
  "b167bfd951cf9acecb6ff2470ed0fb8c1925097e";

export const FRONTEND_BASE_SHA =
  "20a06f048510a2519e0487d12ea7c16f59e7fd7c";

export const BACKEND_PIN_SHA =
  "637583f42b7c475ef83f6f99bca7e65e665a253d";

export const OPENAPI_AUTHORITY_SHA =
  "4042FB2725DA70A02A70EE09563B7698AE2E5DA82927614CAF1B5F7E6AA7C1D0";

export const EXPECTED_MIGRATION_HEAD = "a360s010004";

/** Canonical coherent School Context identities (Backend S04 defaults). */
export const DEV_TENANT_ID = "71b5fb49-2bdb-56c3-ab7c-3b33e92a89f0";
export const DEV_TEACHER_PRINCIPAL_ID = "f85329ab-f05b-564e-a67b-318f3e1f3cf3";
export const DEV_STUDENT_A_PRINCIPAL_ID =
  "9d9c5063-28b3-555f-95f1-1265145be7bb";
export const DEV_STUDENT_B_PRINCIPAL_ID =
  "3592cb8e-e421-5277-8753-8506e7a8daf6";
export const DEV_PRINCIPAL_PRINCIPAL_ID =
  "336ffa8c-40ca-50c2-a62a-a40dd0061b55";
export const DEV_PARENT_A_PRINCIPAL_ID =
  "01306aa8-09c8-558f-a777-5c9b6e7b495b";

/** Opaque development transport bearers — not Principal UUIDs / not authority. */
export const DEV_TEACHER_BEARER_TOKEN = "aieos360-s04-i03-e2e-teacher";
export const DEV_STUDENT_A_BEARER_TOKEN = "dev-student-a";
export const DEV_STUDENT_B_BEARER_TOKEN = "dev-student-b";
export const DEV_PRINCIPAL_BEARER_TOKEN = "aieos360-s04-i03-e2e-principal";
export const DEV_PARENT_BEARER_TOKEN = "aieos360-s04-i03-e2e-parent";

export const DEFAULT_TEACHER_BACKEND_PORT = 8010;
export const DEFAULT_STUDENT_BACKEND_PORT = 8011;
export const DEFAULT_PRINCIPAL_BACKEND_PORT = 8012;
export const DEFAULT_PARENT_BACKEND_PORT = 8013;
export const DEFAULT_TEACHER_FRONTEND_PORT = 5281;
export const DEFAULT_STUDENT_FRONTEND_PORT = 5282;
export const DEFAULT_PRINCIPAL_FRONTEND_PORT = 5283;
export const DEFAULT_PARENT_FRONTEND_PORT = 5284;
export const DEFAULT_PG_PORT = 55438;
export const I03_E2E_CONTAINER = "aieos-aieos360-s04-i03-e2e-pg";

export function resolveBackendRoot() {
  const root = process.env.AIEOS_BACKEND_ROOT;
  if (!root) {
    throw new Error(
      "AIEOS_BACKEND_ROOT is required (path to eduvijna-aieos-backend checkout).",
    );
  }
  return root;
}
