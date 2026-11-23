#!/usr/bin/env node
import assert from "node:assert/strict";
import { cleanupFullPkV1HintE2e } from "./managed_lifecycle.mjs";

const ci = cleanupFullPkV1HintE2e({ ciExternal: true });
assert.equal(ci.ok, true);
assert.ok(
  ci.containerResults.every(
    (r) => r.containerOutcome?.reason === "CI_EXTERNAL_PG" || r.ok,
  ),
);

console.log(JSON.stringify({ lifecycle_selftest: "ok" }));