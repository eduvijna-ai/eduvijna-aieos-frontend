import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const selfDir = dirname(fileURLToPath(import.meta.url));
import {
  assertManagedStatusReport,
  parseStatusStdout,
} from "./managed_status_gate.mjs";

const sample = {
  operator_status: { phase: "running" },
  live_process_count: 8,
  missing_live_roles: [],
  registry_truth: "live_registry_matches_expected",
  readiness_ok: true,
  health_checks: Array.from({ length: 16 }, (_, index) => ({
    role: `role-${index % 8}`,
    surface: index % 2 === 0 ? "backend" : "frontend",
    ok: true,
  })),
};

assertManagedStatusReport(sample);

const noisyStdout = `> eduvijna-aieos-frontend@0.0.0 showcase:aieos360:status
${JSON.stringify(sample)}`;
assert.deepEqual(parseStatusStdout(noisyStdout).readiness_ok, true);

const rehearse = readFileSync(join(selfDir, "rehearse.mjs"), "utf8");
assert.ok(!rehearse.includes("STATUS_SKIP_LIVE"));
assert.ok(rehearse.includes("status.mjs"));
assert.ok(rehearse.includes("ownedStartAttempted"));
assert.ok(rehearse.includes("if (ownedLifecycle)"));

console.log("rehearse_lifecycle.selftest: pass");
