#!/usr/bin/env node
/**
 * AIEOS360-CX01-I07 — governed local integrated rehearsal (NON_PRODUCTION).
 *
 * Local (Linux/WSL2): pin guard → registry gate → I01R9 reset → managed start →
 * Playwright guard (reuses managed 5291–5294 / 8020–8023, no reseed) → stop (finally).
 *
 * CI uses job `aieos360-cx01-i07-e2e` (isolated ports 5295–5298 / 8024–8027, external PG).
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { failClosedNonLinuxExit } from "../aieos360-cx01-i01r9-showcase-rehearsal/linux_platform.mjs";
import { runPinGuard } from "../aieos360-cx01-i01r9-showcase-rehearsal/pin_guard.mjs";
import { assertManagedStartRegistryGate } from "../aieos360-cx01-i01r9-showcase-rehearsal/process_group.mjs";
import { repoRoot } from "../aieos360-cx01-i01r9-showcase-rehearsal/paths.mjs";
import { buildI07PythonBootstrapEnv } from "../aieos360-cx01-i07-e2e/child_env.mjs";
import {
  assertManagedStatusReport,
  parseStatusStdout,
} from "./managed_status_gate.mjs";
import {
  buildRehearsalReport,
  finalizeExitCode,
  resolveCleanupPlan,
} from "./rehearse_report.mjs";

const statusScript = join(
  repoRoot,
  "scripts/aieos360-cx01-i01r9-showcase-rehearsal/status.mjs",
);

const tmpDir = join(repoRoot, "tmp");
mkdirSync(tmpDir, { recursive: true });
const reportPath = join(tmpDir, "aieos360-cx01-i07-rehearsal-report.json");

function run(command, args, extraEnv = {}) {
  const childEnv = buildI07PythonBootstrapEnv(process.env, extraEnv);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: childEnv,
    encoding: "utf8",
    stdio: "inherit",
  });
  return result.status ?? 1;
}

function writeReport(payload) {
  writeFileSync(reportPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

function assertManagedStackReady() {
  const result = spawnSync(process.execPath, [statusScript], {
    cwd: repoRoot,
    env: buildI07PythonBootstrapEnv(process.env),
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      `CX01-I07 rehearse: managed status failed after start: ${result.stderr || result.stdout}`,
    );
  }
  assertManagedStatusReport(parseStatusStdout(result.stdout));
}

function cleanupOwnedStackAfterPartialStart() {
  const stopCode = run("pnpm", ["showcase:aieos360:stop"]);
  steps.push({
    step: "showcase_stop_after_partial_start",
    status: stopCode === 0 ? "pass" : "fail",
  });
  return stopCode;
}

const started = Date.now();
const steps = [];
const ciOnly = process.env.AIEOS360_CX01_I07_REHEARSE_CI === "1";

if (ciOnly) {
  console.error(
    "pnpm showcase:aieos360:rehearse is for local managed rehearsal only. " +
      "CI uses pnpm test:e2e:aieos360-cx01-i07 in job aieos360-cx01-i07-e2e.",
  );
  process.exit(2);
}

failClosedNonLinuxExit("showcase:aieos360:rehearse");

let exitCode = 1;
let failureReason = null;
let ownedLifecycle = false;
let ownedStartAttempted = false;

try {
  if (!process.env.AIEOS_BACKEND_ROOT) {
    throw new Error("AIEOS_BACKEND_ROOT is required for local integrated rehearsal");
  }

  runPinGuard();
  steps.push({ step: "pin_guard", status: "pass" });

  const gate = assertManagedStartRegistryGate();
  if (!gate.ok) {
    throw new Error(
      `CX01-I07 rehearse blocked — managed showcase registry: ${gate.code} ${gate.reason ?? ""}`,
    );
  }
  steps.push({ step: "registry_gate", status: "pass" });

  exitCode = run("pnpm", ["showcase:aieos360:reset"]);
  steps.push({ step: "showcase_reset", status: exitCode === 0 ? "pass" : "fail" });
  if (exitCode !== 0) {
    throw new Error("showcase reset failed");
  }

  ownedStartAttempted = true;
  exitCode = run("pnpm", ["showcase:aieos360:start"]);
  steps.push({ step: "showcase_start", status: exitCode === 0 ? "pass" : "fail" });
  if (exitCode !== 0) {
    throw new Error("showcase start failed");
  }
  ownedLifecycle = true;

  assertManagedStackReady();
  steps.push({ step: "managed_status_gate", status: "pass" });

  exitCode = run("pnpm", ["test:e2e:aieos360-cx01-i07"], {
    AIEOS360_CX01_I07_REHEARSE_MANAGED_STACK: "1",
    AIEOS360_CX01_I07_E2E_SKIP_BOOTSTRAP: "1",
  });
  steps.push({
    step: "integrated_e2e_guard_managed_stack",
    status: exitCode === 0 ? "pass" : "fail",
  });
  if (exitCode !== 0) {
    failureReason = "integrated_e2e_guard_managed_stack exited nonzero";
  }
} catch (error) {
  failureReason = failureReason ?? String(error);
  console.error(error);
  exitCode = 1;
} finally {
  const cleanupPlan = resolveCleanupPlan({
    ownedLifecycle,
    ownedStartAttempted,
  });
  if (cleanupPlan.runPartialCleanup) {
    const partialStopCode = cleanupOwnedStackAfterPartialStart();
    exitCode = finalizeExitCode(exitCode, partialStopCode);
    if (partialStopCode !== 0) {
      failureReason =
        failureReason ?? "showcase_stop_after_partial_start failed";
    }
  }
  if (cleanupPlan.runOwnedStop) {
    const stopCode = run("pnpm", ["showcase:aieos360:stop"]);
    steps.push({ step: "showcase_stop", status: stopCode === 0 ? "pass" : "fail" });
    exitCode = finalizeExitCode(exitCode, stopCode);
    if (stopCode !== 0) {
      failureReason = failureReason ?? "showcase_stop failed";
    }
  }
}

const outcome = exitCode === 0 ? "pass" : "fail";
writeReport(
  buildRehearsalReport({
    outcome,
    steps,
    startedAt: started,
    failureReason,
    exitCode,
  }),
);
console.log(`CX01-I07 rehearsal report: ${reportPath} (${outcome})`);

process.exit(exitCode);
