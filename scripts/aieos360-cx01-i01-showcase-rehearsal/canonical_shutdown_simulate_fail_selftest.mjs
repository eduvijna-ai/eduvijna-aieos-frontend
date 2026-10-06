#!/usr/bin/env node
import { executeCanonicalShutdown } from "./canonical_shutdown.mjs";
import { writeProcessRegistry } from "./process_registry.mjs";

process.env.AIEOS360_CX01_I01_SHOWCASE_SIGNAL_PROOF_HARNESS = "1";
writeProcessRegistry({ children: [] });

const outcome = await executeCanonicalShutdown({
  expectContainer: false,
  simulateStopFailure: true,
});

if (outcome.phase !== "stop_failed") {
  console.error(JSON.stringify(outcome, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, phase: outcome.phase }));
