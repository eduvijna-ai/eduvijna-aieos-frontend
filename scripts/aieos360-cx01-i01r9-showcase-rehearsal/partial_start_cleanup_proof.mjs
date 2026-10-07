#!/usr/bin/env node
/**
 * Proof A: partial managed start failure cleans governed process groups and ports.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_TEACHER_BACKEND_PORT } from "./constants.mjs";
import {
  assertPortsReleased,
  collectManagedEvidence,
  DEFAULT_GOVERNED_APP_PORTS,
} from "./managed_evidence.mjs";
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

const blockedStudentPort = 59997;
const start = runNode("start.mjs", {
  AIEOS360_CX01_I01_SHOWCASE_SKIP_RESET: "1",
  AIEOS360_CX01_I01_SHOWCASE_STUDENT_BACKEND_PORT: String(blockedStudentPort),
  AIEOS360_CX01_I01_SHOWCASE_START_READINESS_TIMEOUT_MS: "8000",
});
if (start.status === 0) {
  console.error("expected start.mjs to fail with blocked student backend port");
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

try {
  await assertPortsReleased(DEFAULT_GOVERNED_APP_PORTS);
} catch (error) {
  console.error(String(error));
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
  blocked_student_backend_port: blockedStudentPort,
  governed_app_ports_released: operatorStatus.governed_app_ports_released,
  live_process_count_after_cleanup: evidence.live_process_count,
  cleanup_stop_timing: cleanup.stopTiming,
  managed_evidence_after_cleanup: operatorStatus.managed_evidence_after_cleanup,
};
const out = join(repoRoot, "tmp", "aieos360-cx01-i01-showcase-partial-start-cleanup-proof.json");
mkdirSync(join(repoRoot, "tmp"), { recursive: true });
writeFileSync(out, JSON.stringify(proof, null, 2) + "\n", "utf8");
console.log(JSON.stringify(proof, null, 2));
