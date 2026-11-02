#!/usr/bin/env node
/**
 * AIEOS360-CX01-I07 — governed local integrated rehearsal (NON_PRODUCTION).
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
import { runRehearsalOrchestration } from "./rehearse_orchestration.mjs";
import { verifyOwnedRegistryClear } from "./rehearse_owned_registry.mjs";
import { buildRehearsalReport } from "./rehearse_report.mjs";
import { toReportSafeFailureMessage } from "./rehearse_report_sanitize.mjs";

const statusScript = join(
  repoRoot,
  "scripts/aieos360-cx01-i01r9-showcase-rehearsal/status.mjs",
);

const tmpDir = join(repoRoot, "tmp");
mkdirSync(tmpDir, { recursive: true });
const reportPath = join(tmpDir, "aieos360-cx01-i07-rehearsal-report.json");

function runManagedCommand(command, args, extraEnv = {}) {
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

const ciOnly = process.env.AIEOS360_CX01_I07_REHEARSE_CI === "1";

if (ciOnly) {
  console.error(
    "pnpm showcase:aieos360:rehearse is for local managed rehearsal only. " +
      "CI uses pnpm test:e2e:aieos360-cx01-i07 in job aieos360-cx01-i07-e2e.",
  );
  process.exit(2);
}

failClosedNonLinuxExit("showcase:aieos360:rehearse");

const result = runRehearsalOrchestration({
  env: process.env,
  runPinGuard,
  assertManagedStartRegistryGate,
  runManagedCommand,
  assertManagedStackReady,
  runPartialCleanup(steps) {
    const stopCode = runManagedCommand("pnpm", ["showcase:aieos360:stop"]);
    steps.push({
      step: "showcase_stop_after_partial_start",
      status: stopCode === 0 ? "pass" : "fail",
    });
    return stopCode;
  },
  runOwnedStop() {
    return runManagedCommand("pnpm", ["showcase:aieos360:stop"]);
  },
  verifyOwnedRegistryClear,
});

if (result.failureReason) {
  console.error(
    toReportSafeFailureMessage(result.failureReason, "rehearsal_failed"),
  );
}

const outcome = result.exitCode === 0 ? "pass" : "fail";
writeReport(
  buildRehearsalReport({
    outcome,
    steps: result.steps,
    startedAt: result.started,
    failureReason: result.failureReason,
    exitCode: result.exitCode,
  }),
);
console.log(`CX01-I07 rehearsal report: ${reportPath} (${outcome})`);

process.exit(result.exitCode);
