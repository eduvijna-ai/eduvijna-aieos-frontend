import { cleanupFullPkV1HintE2e } from "./managed_lifecycle.mjs";

export default async function globalTeardown() {
  if (process.env.PK_V1_HINT_E2E_MANAGED_WRAPPER === "1") {
    return;
  }
  const ciExternal =
    process.env.PK_V1_HINT_E2E_CI_EXTERNAL_PG === "1" ||
    Boolean(process.env.AIEOS_TEST_DATABASE_URL);
  cleanupFullPkV1HintE2e({ ciExternal });
}