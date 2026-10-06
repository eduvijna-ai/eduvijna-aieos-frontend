#!/usr/bin/env node
/** Injected failure paths: partial start cleanup, reset failure must not proceed. */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { canonicalStop, runNodeSync } from "./proof_orchestration.mjs";
import { isPidAlive, readProcessRegistry } from "./process_registry.mjs";
import { tmpDir } from "./paths.mjs";

const results = [];

function assertCase(name, ok, detail = {}) {
  results.push({ case: name, ok, ...detail });
  if (!ok) {
    throw new Error(`injected failure proof case failed: ${name}`);
  }
}

mkdirSync(tmpDir, { recursive: true });

try {
  const partialStart = runNodeSync(
    "start.mjs",
    {
      AIEOS360_CX01_I01_SHOWCASE_SKIP_RESET: "1",
      AIEOS360_CX01_I01_SHOWCASE_START_MODE: "managed",
      AIEOS360_CX01_I01_SHOWCASE_INJECT_PARTIAL_START_AFTER: "3",
    },
    120_000,
  );
  assertCase("partial_start_injection_fails", partialStart.status !== 0, {
    status: partialStart.status,
  });
  const stopAfterPartial = canonicalStop();
  assertCase("partial_start_canonical_stop_runs", stopAfterPartial.status === 0, {
    status: stopAfterPartial.status,
  });
  const registry = readProcessRegistry();
  const liveLeftovers = (registry.children ?? []).filter((entry) =>
    isPidAlive(entry.pid),
  );
  assertCase("partial_start_no_live_registry_survivors", liveLeftovers.length === 0, {
    survivors: liveLeftovers.length,
  });

  const forcedReset = runNodeSync(
    "reset.mjs",
    { AIEOS360_CX01_I01_SHOWCASE_FORCE_RESET_FAIL: "1" },
    30_000,
  );
  assertCase("injected_reset_failure_exits_nonzero", forcedReset.status !== 0, {
    status: forcedReset.status,
  });

  const lifecycleResetFail = runNodeSync(
    "lifecycle_proof.mjs",
    { AIEOS360_CX01_I01_SHOWCASE_FORCE_RESET_FAIL: "1" },
    60_000,
  );
  assertCase("lifecycle_blocks_when_canonical_reset_fails", lifecycleResetFail.status !== 0, {
    status: lifecycleResetFail.status,
  });
} finally {
  canonicalStop();
}

const proof = {
  classification: "NON_PRODUCTION",
  cases: results,
};
writeFileSync(
  join(tmpDir, "aieos360-cx01-i01-showcase-injected-failure-proof.json"),
  JSON.stringify(proof, null, 2) + "\n",
  "utf8",
);
console.log(JSON.stringify(proof, null, 2));
