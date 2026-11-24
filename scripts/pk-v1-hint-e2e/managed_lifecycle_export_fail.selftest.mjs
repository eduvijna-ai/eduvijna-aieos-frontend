#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanupFullPkV1HintE2e, cleanupRawTmpArtifacts } from "./managed_lifecycle.mjs";

const tmpRoot = mkdtempSync(join(tmpdir(), "pk-v1-hint-lifecycle-"));
const rawNames = [
  "pk-v1-hint-e2e-fixture.json",
  "pk-v1-hint-e2e-db.json",
  "pk-v1-hint-e2e-docker-ownership.json",
];

for (const name of rawNames) {
  writeFileSync(
    join(tmpRoot, name),
    JSON.stringify({ secret: "postgresql://user:pass@127.0.0.1:5432/aieos" }),
    "utf8",
  );
}

let cleanupCalls = 0;
const result = cleanupFullPkV1HintE2e({
  ciExternal: false,
  exportFn: () => ({ ok: false, code: "SANITIZED_EXPORT_FAILED" }),
  cleanupRoleFn: () => {
    cleanupCalls += 1;
    return { ok: true, role: "primary", containerOutcome: { skipped: true } };
  },
  rawCleanupFn: (opts) =>
    cleanupRawTmpArtifacts({ ...opts, tmpRoot }),
});

assert.equal(cleanupCalls, 2, "container cleanup must run after export failure");
assert.equal(result.ok, false);
assert.equal(result.code, "SANITIZED_EXPORT_FAILED");
for (const name of ["pk-v1-hint-e2e-fixture.json", "pk-v1-hint-e2e-db.json"]) {
  assert.equal(existsSync(join(tmpRoot, name)), false, `${name} must be scrubbed`);
}
assert.equal(
  existsSync(join(tmpRoot, "pk-v1-hint-e2e-docker-ownership.json")),
  false,
  "ownership file removed when cleanup permitted",
);

const again = cleanupFullPkV1HintE2e({
  ciExternal: true,
  skipSanitizedExport: true,
  rawCleanupFn: (opts) => cleanupRawTmpArtifacts({ ...opts, tmpRoot }),
});
assert.equal(again.ok, true, "idempotent second pass on empty tmp root");

console.log(
  JSON.stringify({
    managed_lifecycle_export_fail_selftest: "ok",
    tmp_root: tmpRoot,
  }),
);