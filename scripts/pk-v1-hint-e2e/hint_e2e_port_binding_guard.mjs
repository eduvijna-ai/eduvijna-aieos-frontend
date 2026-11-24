/** Governed loopback port bindings for pk-v1-hint real-stack E2E (no env override bypass). */

import {
  DEFAULT_STUDENT_BACKEND_PORT,
  DEFAULT_STUDENT_FRONTEND_PORT,
  DEFAULT_TEACHER_BACKEND_PORT,
  DEFAULT_TEACHER_FRONTEND_PORT,
} from "./constants.mjs";

export const GOVERNED_PORT_ENV_BINDINGS = [
  ["PK_V1_HINT_E2E_TEACHER_BACKEND_PORT", DEFAULT_TEACHER_BACKEND_PORT],
  ["PK_V1_HINT_E2E_STUDENT_BACKEND_PORT", DEFAULT_STUDENT_BACKEND_PORT],
  ["PK_V1_HINT_E2E_TEACHER_FRONTEND_PORT", DEFAULT_TEACHER_FRONTEND_PORT],
  ["PK_V1_HINT_E2E_STUDENT_FRONTEND_PORT", DEFAULT_STUDENT_FRONTEND_PORT],
];

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ ok: boolean, violations: string[] }}
 */
export function evaluateHintE2ePortBindings(env = process.env) {
  const violations = [];
  const resolved = [];
  for (const [key, expected] of GOVERNED_PORT_ENV_BINDINGS) {
    const raw = env[key];
    let effective = expected;
    if (raw !== undefined && raw !== "") {
      const parsed = Number(raw);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
        violations.push(key);
        continue;
      }
      if (parsed !== expected) {
        violations.push(key);
        continue;
      }
      effective = parsed;
    }
    resolved.push(effective);
  }
  if (new Set(resolved).size !== resolved.length) {
    violations.push("DUPLICATE_RESOLVED_PORT");
  }
  return { ok: violations.length === 0, violations };
}

/** @param {NodeJS.ProcessEnv} [env] */
export function assertHintE2ePortBindingsOrExit(env = process.env) {
  const result = evaluateHintE2ePortBindings(env);
  if (!result.ok) {
    console.error(
      JSON.stringify({
        pk_v1_hint_port_binding_guard: "rejected",
        violations: result.violations,
      }),
    );
    process.exit(2);
  }
  return result;
}