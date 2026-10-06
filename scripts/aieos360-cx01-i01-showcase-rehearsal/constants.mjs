/** AIEOS360-CX01-I01 showcase rehearsal governed pins (NON_PRODUCTION). */

export const ARCHITECTURE_PIN_SHA =
  "491295c3cf0a151f31686a6a2e1a2176cd92c782";

export const PRODUCT_PIN_SHA =
  "b4b3048fb7a6a1c50ae8619dc490743714f2e3e2";

export const INFRASTRUCTURE_PIN_SHA =
  "a8654e5bc680eac1fa93cf8308d7cad904f4d7b9";

export const FRONTEND_BASE_SHA =
  "80125be6cf172afb5137e845752c5b4505e5a97f";

export const BACKEND_PIN_SHA =
  "637583f42b7c475ef83f6f99bca7e65e665a253d";

export const OPENAPI_AUTHORITY_SHA =
  "4042FB2725DA70A02A70EE09563B7698AE2E5DA82927614CAF1B5F7E6AA7C1D0";

export const EXPECTED_MIGRATION_HEAD = "a360s010004";

export const SCENARIO_ID = "aieos360-cx01-i01-showcase-rehearsal";
export const APPROVED_CLIENT_SCENARIO_ID = "AIEOS360-CX-SCENARIO-01";
export const SCENARIO_VERSION = "1";
export const CLASSIFICATION = "NON_PRODUCTION";

/** Dedicated disposable rehearsal PostgreSQL 18 container identity. */
export const CX01_SHOWCASE_CONTAINER = "aieos-aieos360-cx01-i01-showcase-pg";
export const DEDICATED_PG_HOST_PORT = 55448;

/** Canonical coherent School Context identities (Backend development defaults). */
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

export const CLASS_REF_5A = "class-5a";
export const CLASS_REF_5B = "class-5b";

/** Opaque development transport bearers — not Principal UUIDs / not authority. */
export const DEV_TEACHER_BEARER_TOKEN = "aieos360-cx01-i01-showcase-teacher";
export const DEV_STUDENT_A_BEARER_TOKEN = "dev-student-a";
export const DEV_STUDENT_B_BEARER_TOKEN = "dev-student-b";
export const DEV_PRINCIPAL_BEARER_TOKEN = "aieos360-cx01-i01-showcase-principal";
export const DEV_PARENT_BEARER_TOKEN = "aieos360-cx01-i01-showcase-parent";

export const DEFAULT_TEACHER_BACKEND_PORT = 8020;
export const DEFAULT_STUDENT_BACKEND_PORT = 8021;
export const DEFAULT_PRINCIPAL_BACKEND_PORT = 8022;
export const DEFAULT_PARENT_BACKEND_PORT = 8023;
export const DEFAULT_TEACHER_FRONTEND_PORT = 5291;
export const DEFAULT_STUDENT_FRONTEND_PORT = 5292;
export const DEFAULT_PRINCIPAL_FRONTEND_PORT = 5293;
export const DEFAULT_PARENT_FRONTEND_PORT = 5294;
export const DEFAULT_PG_PORT = DEDICATED_PG_HOST_PORT;

export function resolveBackendRoot() {
  const root = process.env.AIEOS_BACKEND_ROOT;
  if (!root) {
    throw new Error(
      "AIEOS_BACKEND_ROOT is required (path to eduvijna-aieos-backend checkout).",
    );
  }
  return root;
}
