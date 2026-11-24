#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  evaluateHintE2ePortBindings,
  GOVERNED_PORT_ENV_BINDINGS,
} from "./hint_e2e_port_binding_guard.mjs";

const governed = Object.fromEntries(
  GOVERNED_PORT_ENV_BINDINGS.map(([key, port]) => [key, String(port)]),
);

assert.equal(evaluateHintE2ePortBindings({}).ok, true);
assert.equal(evaluateHintE2ePortBindings(governed).ok, true);

const badTeacherBackend = {
  ...governed,
  PK_V1_HINT_E2E_TEACHER_BACKEND_PORT: "9000",
};
const rejected = evaluateHintE2ePortBindings(badTeacherBackend);
assert.equal(rejected.ok, false);
assert.ok(rejected.violations.includes("PK_V1_HINT_E2E_TEACHER_BACKEND_PORT"));

const nonNumeric = {
  PK_V1_HINT_E2E_TEACHER_BACKEND_PORT: "not-a-port",
};
assert.equal(evaluateHintE2ePortBindings(nonNumeric).ok, false);

const outOfRange = {
  PK_V1_HINT_E2E_TEACHER_FRONTEND_PORT: "70000",
};
assert.equal(evaluateHintE2ePortBindings(outOfRange).ok, false);

console.log(JSON.stringify({ pk_v1_hint_port_binding_guard_selftest: "pass" }));