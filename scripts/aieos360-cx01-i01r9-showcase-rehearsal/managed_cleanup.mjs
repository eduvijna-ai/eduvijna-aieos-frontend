import { readFileSync, existsSync } from "node:fs";
import { createServer } from "node:net";
import { DEDICATED_PG_HOST_PORT } from "./constants.mjs";
import { removeOwnedContainer } from "./docker_ownership.mjs";
import { dbReportPath } from "./paths.mjs";
import { stopRegisteredProcessGroups } from "./process_group.mjs";

export function usesExternalCiPostgres() {
  return (
    Boolean(process.env.AIEOS_TEST_DATABASE_URL) &&
    process.env.AIEOS360_CX01_I01_SHOWCASE_CI_EXTERNAL_PG === "1"
  );
}

export function localOwnedContainerExpected() {
  if (usesExternalCiPostgres()) {
    return false;
  }
  if (!existsSync(dbReportPath)) {
    return false;
  }
  const db = JSON.parse(readFileSync(dbReportPath, "utf8"));
  return db.started_container === true;
}

export async function assertPortsReleased(ports) {
  for (const port of ports) {
    await new Promise((resolve, reject) => {
      const server = createServer();
      server.once("error", reject);
      server.listen(port, "127.0.0.1", () => {
        server.close(() => resolve(undefined));
      });
    });
  }
}

/**
 * Stop registered process groups; optionally remove governed owned local PG container.
 */
export async function cleanupManagedStack({
  removeOwnedLocalContainer = false,
  assertGovernedPgPortReleased = false,
} = {}) {
  const outcome = await stopRegisteredProcessGroups();
  let containerOutcome = null;

  if (removeOwnedLocalContainer && localOwnedContainerExpected()) {
    containerOutcome = removeOwnedContainer();
    if (containerOutcome.inspection_error) {
      return {
        ...outcome,
        containerOutcome,
        ok: false,
        error: containerOutcome.error,
      };
    }
    if (!containerOutcome.removed && !containerOutcome.missing) {
      return {
        ...outcome,
        containerOutcome,
        ok: false,
        error: containerOutcome.error || "owned container not removed",
      };
    }
  }

  if (assertGovernedPgPortReleased && localOwnedContainerExpected()) {
    try {
      await assertPortsReleased([DEDICATED_PG_HOST_PORT]);
    } catch (error) {
      return {
        ...outcome,
        containerOutcome,
        ok: false,
        error: `governed PG port ${DEDICATED_PG_HOST_PORT} not released: ${error}`,
      };
    }
  }

  const processOk = outcome.rejected.length === 0;
  return {
    ...outcome,
    containerOutcome,
    ok: processOk,
  };
}
