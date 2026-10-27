#!/usr/bin/env node
/**
 * AIEOS360-CX01-I07 — one-command integrated rehearsal proof (NON_PRODUCTION).
 * Local: governed reset → managed start → Playwright guard → stop.
 * CI: use job `aieos360-cx01-i07-e2e` (external PostgreSQL, no Docker lifecycle).
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runPinGuard } from "../aieos360-cx01-i01r9-showcase-rehearsal/pin_guard.mjs";
import { repoRoot } from "../aieos360-cx01-i01r9-showcase-rehearsal/paths.mjs";

const tmpDir = join(repoRoot, "tmp");
mkdirSync(tmpDir, { recursive: true });
const reportPath = join(tmpDir, "aieos360-cx01-i07-rehearsal-report.json");

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: { ...process.env, ...extraEnv },
    encoding: "utf8",
    stdio: "inherit",
  });
  return result.status ?? 1;
}

const started = Date.now();
const steps = [];

try {
  runPinGuard();
  steps.push({ step: "pin_guard", status: "pass" });

  if (!process.env.AIEOS_BACKEND_ROOT) {
    throw new Error("AIEOS_BACKEND_ROOT is required for integrated rehearsal proof");
  }

  const e2eCode = run("pnpm", ["test:e2e:aieos360-cx01-i07"]);
  steps.push({ step: "integrated_e2e_guard", status: e2eCode === 0 ? "pass" : "fail" });
  if (e2eCode !== 0) process.exit(e2eCode);

  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        package: "AIEOS360-CX01-I07",
        scenario_id: "AIEOS360-CX-SCENARIO-01",
        substrate: "aieos360-cx01-i01-showcase-rehearsal",
        outcome: "pass",
        duration_ms: Date.now() - started,
        steps,
        classification: "NON_PRODUCTION",
        real_ai_live_generation: "PENDING",
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  console.log(`CX01-I07 rehearsal report: ${reportPath}`);
} catch (error) {
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        package: "AIEOS360-CX01-I07",
        outcome: "fail",
        error: String(error),
        duration_ms: Date.now() - started,
        steps,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  console.error(error);
  process.exit(1);
}
