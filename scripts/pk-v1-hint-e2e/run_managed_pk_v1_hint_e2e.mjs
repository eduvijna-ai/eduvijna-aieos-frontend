#!/usr/bin/env node
/**
 * Governed lifecycle wrapper for pk-v1-hint Playwright lane.
 * Exports sanitized evidence, then tears down owned containers and raw tmp artifacts.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { cleanupFullPkV1HintE2e } from "./managed_lifecycle.mjs";
import { combineManagedExitCode } from "./lifecycle_logic.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../..");

const ciExternal =
  process.env.PK_V1_HINT_E2E_CI_EXTERNAL_PG === "1" ||
  Boolean(process.env.AIEOS_TEST_DATABASE_URL);

let teardownDone = false;
let child = null;
let shuttingDown = false;

const CHILD_TERM_MS = 120_000;

function runTeardown() {
  if (teardownDone) {
    return { ok: true, skipped: true };
  }
  teardownDone = true;
  return cleanupFullPkV1HintE2e({ ciExternal });
}

function shutdownAndExit(childExitCode) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  const teardown = runTeardown();
  const exitCode = combineManagedExitCode(childExitCode, teardown.ok === true);
  const summary = {
    pk_v1_hint_managed_e2e_exit: exitCode,
    child_exit: childExitCode ?? null,
    lifecycle_teardown_ok: teardown.ok === true,
    lifecycle_code: teardown.code || null,
  };
  console.log(JSON.stringify(summary));
  process.exit(exitCode);
}

function waitForChildExit(signal) {
  return new Promise((resolve) => {
    if (!child || child.killed) {
      resolve(child?.exitCode ?? (signal === "SIGINT" ? 130 : 143));
      return;
    }
    const timer = setTimeout(() => {
      if (child && !child.killed) {
        child.kill("SIGKILL");
      }
      resolve(signal === "SIGINT" ? 130 : 143);
    }, CHILD_TERM_MS);
    child.once("close", (code) => {
      clearTimeout(timer);
      resolve(code ?? 1);
    });
    try {
      child.kill(signal);
    } catch {
      clearTimeout(timer);
      resolve(1);
    }
  });
}

process.on("SIGINT", async () => {
  const code = await waitForChildExit("SIGINT");
  shutdownAndExit(code);
});

process.on("SIGTERM", async () => {
  const code = await waitForChildExit("SIGTERM");
  shutdownAndExit(code);
});

child = spawn(
  "pnpm",
  ["exec", "playwright", "test", "--config", "playwright.pk-v1-hint-e2e.config.ts"],
  {
    cwd: repoRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      PK_V1_HINT_E2E_MANAGED_WRAPPER: "1",
      PK_V1_HINT_E2E_RAN: "1",
    },
  },
);

child.on("error", () => shutdownAndExit(1));
child.on("close", (code) => shutdownAndExit(code ?? 1));