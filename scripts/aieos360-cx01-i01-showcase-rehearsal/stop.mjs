#!/usr/bin/env node
import { executeCanonicalShutdown } from "./canonical_shutdown.mjs";

const outcome = await executeCanonicalShutdown();

if (outcome.phase === "stop_failed") {
  console.error(
    JSON.stringify(
      {
        phase: outcome.phase,
        rejected: outcome.rejected,
        survivors: outcome.survivors,
        failed: outcome.failed,
        containerRemoveError: outcome.containerRemoveError,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      stopped: true,
      classification: "NON_PRODUCTION",
      container_removed: outcome.containerRemoved,
      phase: outcome.phase,
      rejected_count: outcome.rejected.length,
    },
    null,
    2,
  ),
);
