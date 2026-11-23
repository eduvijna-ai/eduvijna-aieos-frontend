#!/usr/bin/env node
/**
 * Governed lifecycle wrapper for pk-v1-hint Playwright lane.
 * Always tears down owned primary+probe containers and raw tmp artifacts.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { cleanupFullPkV1HintE2e } from "./managed_lifecycle.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../..");

const ciExternal =
  process.env.PK_V1_HINT_E2E_CI_EXTERNAL_PG === "1" ||
  Boolean(process.env.AIEOS_TEST_DATABASE_URL);

let teardownDone = false;

function runTeardown() {
  if (teardownDone) {
    return { ok: true, skipped: true };
  }
  teardownDone = true;
  return cleanupFullPkV1HintE2e({ ciExternal });
}

function shutdownAndExit(code) {
  const teardown = runTeardown();
  const summary = {
    pk_v1_hint_managed_e2e_exit: code,
    lifecycle_teardown_ok: teardown.ok === true,
    lifecycle_code: teardown.code || null,
  };
  console.log(JSON.stringify(summary));
  process.exit(code);
}

process.on("SIGINT", () => shutdownAndExit(130));
process.on("SIGTERM", () => shutdownAndExit(143));

const child = spawn(
  "pnpm",
  ["exec", "playwright", "test", "--config", "playwright.pk-v1-hint-e2e.config.ts"],
  {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  },
);

child.on("error", () => shutdownAndExit(1));
child.on("close", (code) => shutdownAndExit(code ?? 1));