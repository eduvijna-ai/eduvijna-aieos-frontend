/** TOS-DEV10 governed pins (Teacher Memory / prior product E2E). */

export const FRONTEND_BASE_SHA =
  "08887e3f6a427e8e3f5aed852fb3d9a4031a9ff4";

export const BACKEND_PIN_SHA =
  "79d50f04773ceeb1eca91f7b6561cee2ef2f3151";

export const OPENAPI_AUTHORITY_SHA =
  "9B36BD1BF21BA4935A8ACA031176F9C57A06EB2E54E3ACA2261A7D7B6C3EDA69";

export const EXPECTED_MIGRATION_HEAD = "tosd100001";

/** Synthetic development tenant/principal from backend teacher_os_review_scenario. */
export const DEV_TENANT_ID = "71b5fb49-2bdb-56c3-ab7c-3b33e92a89f0";
export const DEV_PRINCIPAL_ID = "f85329ab-f05b-564e-a67b-318f3e1f3cf3";
export const DEV_BEARER_TOKEN = "product-e2e-dev";

export const DEFAULT_BACKEND_PORT = 8000;
export const DEFAULT_FRONTEND_PORT = 5181;
export const DEFAULT_PG_PORT = 55433;
export const PRODUCT_E2E_CONTAINER = "aieos-product-e2e-pg";

export function resolveBackendRoot() {
  const root = process.env.AIEOS_BACKEND_ROOT;
  if (!root) {
    throw new Error(
      "AIEOS_BACKEND_ROOT is required (path to eduvijna-aieos-backend checkout).",
    );
  }
  return root;
}
