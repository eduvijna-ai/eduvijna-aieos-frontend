#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  shouldDeleteOwnershipRecord,
  ownedRoleCleanupSucceeded,
  combineManagedExitCode,
  rawArtifactMayBeDeleted,
} from "./lifecycle_logic.mjs";
import { mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  combineFullTeardownOk,
  primaryTeardownFailureCode,
} from "./lifecycle_logic.mjs";
import { cleanupRawTmpArtifacts } from "./managed_lifecycle.mjs";

assert.equal(shouldDeleteOwnershipRecord({ removed: true }), true);
assert.equal(shouldDeleteOwnershipRecord({ missing: true }), true);
assert.equal(shouldDeleteOwnershipRecord({ inspection_error: true }), false);
assert.equal(shouldDeleteOwnershipRecord({ removed: false, code: "DOCKER_RM_FAILED" }), false);

assert.equal(ownedRoleCleanupSucceeded({ inspection_error: true }), false);
assert.equal(ownedRoleCleanupSucceeded({ removed: true }), true);
assert.equal(ownedRoleCleanupSucceeded({ skipped: true, reason: "CI_EXTERNAL_PG" }), true);

assert.equal(combineManagedExitCode(0, true), 0);
assert.equal(combineManagedExitCode(0, false), 124);
assert.equal(combineManagedExitCode(1, true), 1);
assert.equal(combineManagedExitCode(0, false), 124);

const deniedContainers = [
  { ok: false, ownershipPreserved: true, role: "primary" },
];
assert.equal(
  rawArtifactMayBeDeleted({ containerResults: deniedContainers, ciExternal: false }),
  false,
);
assert.equal(rawArtifactMayBeDeleted({ containerResults: [], ciExternal: true }), true);

assert.equal(
  combineFullTeardownOk({
    sanitized: { ok: false, code: "SANITIZED_EXPORT_FAILED" },
    containerResults: [{ ok: true }],
    raw: { ok: true },
  }),
  false,
);
assert.equal(
  primaryTeardownFailureCode({
    sanitized: { ok: false, code: "SANITIZED_EXPORT_FAILED" },
    containerResults: [],
    raw: { ok: true },
  }),
  "SANITIZED_EXPORT_FAILED",
);

const isolatedTmp = mkdtempSync(join(tmpdir(), "pk-v1-hint-raw-artifact-"));
writeFileSync(
  join(isolatedTmp, "pk-v1-hint-e2e-env.json"),
  JSON.stringify({ marker: true }),
  "utf8",
);
const raw = cleanupRawTmpArtifacts({
  preserveOwnership: true,
  tmpRoot: isolatedTmp,
});
assert.equal(raw.ok, true);
assert.equal(existsSync(join(isolatedTmp, "pk-v1-hint-e2e-env.json")), false);

console.log(JSON.stringify({ lifecycle_selftest: "ok", tmp_root: isolatedTmp }));