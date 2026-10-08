#!/usr/bin/env node
/**
 * Proof A: partial managed start failure cleans governed process groups and ports.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_STUDENT_BACKEND_PORT,
  DEFAULT_TEACHER_BACKEND_PORT,
} from "./constants.mjs";
import {
  assertPortsReleased,
  collectManagedEvidence,
} from "./managed_evidence.mjs";
import { createServer } from "node:net";
import { failClosedNonLinuxExit } from "./linux_platform.mjs";
import { repoRoot, statusPath } from "./paths.mjs";

failClosedNonLinuxExit("partial_start_cleanup_proof");

const scriptDir = join(repoRoot, "scripts/aieos360-cx01-i01r9-showcase-rehearsal");
const backendRoot = process.env.AIEOS_BACKEND_ROOT;
if (!backendRoot) {
  console.error("AIEOS_BACKEND_ROOT is required");
  process.exit(1);
}

function runNode(script, extraEnv = {}) {
  return spawnSync("node", [join(scriptDir, script)], {
    cwd: repoRoot,
    env: { ...process.env, ...extraEnv },
    encoding: "utf8",
    timeout: 600_000,
  });
}

const reset = runNode("reset.mjs");
if (reset.status !== 0) {
  console.error(reset.stdout);
  console.error(reset.stderr);
  process.exit(reset.status ?? 1);
}

const OVERRIDE_STUDENT_BACKEND_PORT =
  DEFAULT_STUDENT_BACKEND_PORT === 18021 ? 18022 : 18021;

const start = runNode("start.mjs", {
  AIEOS360_CX01_I01_SHOWCASE_SKIP_RESET: "1",
  AIEOS360_CX01_I01R9_PROOF_FAIL_STUDENT_BACKEND: "1",
  AIEOS360_CX01_I01_SHOWCASE_START_READINESS_TIMEOUT_MS: "120000",
  AIEOS360_CX01_I01_SHOWCASE_STUDENT_BACKEND_PORT: String(
    OVERRIDE_STUDENT_BACKEND_PORT,
  ),
});
if (start.status === 0) {
  console.error(
    "expected start.mjs to fail with AIEOS360_CX01_I01R9_PROOF_FAIL_STUDENT_BACKEND=1",
  );
  runNode("stop.mjs");
  process.exit(1);
}

if (!existsSync(statusPath)) {
  console.error("operator status missing after failed start");
  process.exit(1);
}
const operatorStatus = JSON.parse(readFileSync(statusPath, "utf8"));
if (operatorStatus.phase !== "start_failed") {
  console.error(`expected start_failed; got ${operatorStatus.phase}`);
  process.exit(1);
}

const evidence = collectManagedEvidence();
if (evidence.live_process_count !== 0) {
  console.error(JSON.stringify(evidence, null, 2));
  process.exit(1);
}

const configuredPorts = operatorStatus.configured_governed_ports;
if (!Array.isArray(configuredPorts) || configuredPorts.length !== 8) {
  console.error("configured_governed_ports missing from start_failed status");
  process.exit(1);
}
if (!configuredPorts.includes(OVERRIDE_STUDENT_BACKEND_PORT)) {
  console.error("configured_governed_ports must include overridden student backend port");
  process.exit(1);
}
if (operatorStatus.governed_app_ports_released !== true) {
  console.error("governed_app_ports_released must be true after configured port check");
  process.exit(1);
}

try {
  await assertPortsReleased(configuredPorts);
} catch (error) {
  console.error(String(error));
  runNode("stop.mjs");
  process.exit(1);
}

const overridePortReleased = await new Promise((resolve) => {
  const server = createServer();
  server.once("error", () => resolve(false));
  server.listen(OVERRIDE_STUDENT_BACKEND_PORT, "127.0.0.1", () => {
    server.close(() => resolve(true));
  });
});
if (!overridePortReleased) {
  console.error(`overridden student backend port ${OVERRIDE_STUDENT_BACKEND_PORT} not released`);
  runNode("stop.mjs");
  process.exit(1);
}

const cleanup = operatorStatus.cleanup_process_groups;
if (!cleanup?.ok) {
  console.error("cleanup_process_groups not ok", JSON.stringify(cleanup, null, 2));
  process.exit(1);
}

const proof = {
  proof: "partial_start_cleanup",
  start_exit_status: start.status,
  operator_phase: operatorStatus.phase,
  teacher_backend_port: DEFAULT_TEACHER_BACKEND_PORT,
  student_backend_port_override: OVERRIDE_STUDENT_BACKEND_PORT,
  configured_governed_ports: configuredPorts,
  proof_fail_student_backend_hook: "AIEOS360_CX01_I01R9_PROOF_FAIL_STUDENT_BACKEND=1",
  governed_app_ports_released: operatorStatus.governed_app_ports_released,
  live_process_count_after_cleanup: evidence.live_process_count,
  cleanup_stop_timing: cleanup.stopTiming,
  managed_evidence_after_cleanup: operatorStatus.managed_evidence_after_cleanup,
};
const out = join(repoRoot, "tmp", "aieos360-cx01-i01-showcase-partial-start-cleanup-proof.json");
mkdirSync(join(repoRoot, "tmp"), { recursive: true });
writeFileSync(out, JSON.stringify(proof, null, 2) + "\n", "utf8");
console.log(JSON.stringify(proof, null, 2));
