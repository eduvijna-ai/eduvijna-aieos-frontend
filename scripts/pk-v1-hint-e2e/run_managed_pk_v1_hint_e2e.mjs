#!/usr/bin/env node
/**
 * Governed lifecycle wrapper for pk-v1-hint Playwright lane.
 * Exports sanitized evidence, then tears down owned containers and raw tmp artifacts.
 */
import { spawn, spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { cleanupFullPkV1HintE2e } from "./managed_lifecycle.mjs";
import { combineManagedExitCode } from "./lifecycle_logic.mjs";
import {
  allowOwnedDatabaseTeardown,
  waitForChildShutdown,
} from "./managed_child_lifecycle.mjs";
import {
  allowDatabaseTeardownAfterWebservers,
  verifyGovernedWebserversReleased,
} from "./managed_webserver_lifecycle.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../..");
const attemptStatusPath = join(repoRoot, "tmp/pk-v1-hint-e2e-attempt-status.json");

function resolveCiExternal() {
  if (process.env.PK_V1_HINT_E2E_CI_EXTERNAL_PG !== "1") {
    return false;
  }
  const proc = spawnSync(
    "python3",
    [join(__dirname, "ci_external_guard.py")],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: process.env,
    },
  );
  if (proc.status !== 0) {
    console.error(
      JSON.stringify({
        pk_v1_hint_ci_external_guard: "failed",
        stderr: proc.stderr?.slice(0, 200) || null,
      }),
    );
    process.exit(2);
  }
  return true;
}

const ciExternal = resolveCiExternal();

let teardownDone = false;
let child = null;
let shuttingDown = false;
let skipContainerTeardown = false;

function buildAttemptRunId() {
  const runId = process.env.GITHUB_RUN_ID;
  const runAttempt = process.env.GITHUB_RUN_ATTEMPT || "1";
  if (runId) {
    return `${runId}-${runAttempt}`;
  }
  return `local-${Date.now()}`;
}

function writeAttemptStatus(patch) {
  mkdirSync(join(repoRoot, "tmp"), { recursive: true });
  let prior = {};
  if (existsSync(attemptStatusPath)) {
    try {
      prior = JSON.parse(readFileSync(attemptStatusPath, "utf8"));
    } catch {
      prior = {};
    }
  }
  writeFileSync(
    attemptStatusPath,
    JSON.stringify({ ...prior, ...patch }, null, 2),
    "utf8",
  );
}

const attemptRunId = buildAttemptRunId();

writeAttemptStatus({
  attempted: true,
  attempt_run_id: String(attemptRunId),
  github_sha: process.env.GITHUB_SHA || null,
  started_at_ms: Date.now(),
  finished: false,
});

function runTeardown() {
  if (teardownDone) {
    return { ok: true, skipped: true };
  }
  teardownDone = true;
  return cleanupFullPkV1HintE2e({ ciExternal, skipContainerTeardown });
}

async function gateWebserversBeforeTeardown(childState) {
  if (!allowOwnedDatabaseTeardown(childState)) {
    skipContainerTeardown = true;
    return { released: false, skipped: true, reason: "CHILD_NOT_CLOSED" };
  }
  const webState = await verifyGovernedWebserversReleased();
  if (!allowDatabaseTeardownAfterWebservers(webState)) {
    skipContainerTeardown = true;
    return { ...webState, skipped: false, reason: "PORTS_STILL_LISTENING" };
  }
  return { ...webState, skipped: false, reason: null };
}

async function shutdownAndExit(childExitCode, childState = { closed: true, timedOut: false }) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  const webGate = await gateWebserversBeforeTeardown(childState);

  const teardown = runTeardown();
  const exitCode = combineManagedExitCode(childExitCode, teardown.ok === true);
  writeAttemptStatus({
    finished: true,
    child_exit: childExitCode ?? null,
    lifecycle_teardown_ok: teardown.ok === true,
    lifecycle_code: teardown.code || null,
    skip_container_teardown: skipContainerTeardown,
    webserver_release_ok: webGate.released === true,
    webserver_occupied_ports: webGate.occupiedPorts || [],
    sanitized_export_ok:
      teardown.sanitized?.ok !== false && teardown.sanitized?.skipped !== true
        ? teardown.sanitized?.ok === true
        : teardown.sanitized?.skipped === true
          ? null
          : false,
  });
  const summary = {
    pk_v1_hint_managed_e2e_exit: exitCode,
    child_exit: childExitCode ?? null,
    lifecycle_teardown_ok: teardown.ok === true,
    lifecycle_code: teardown.code || null,
    skip_container_teardown: skipContainerTeardown,
    webserver_release_ok: webGate.released === true,
    webserver_occupied_ports: webGate.occupiedPorts || [],
  };
  console.log(JSON.stringify(summary));
  process.exit(exitCode);
}

process.on("SIGINT", async () => {
  const state = await waitForChildShutdown(child, "SIGINT");
  await shutdownAndExit(state.exitCode ?? 130, state);
});

process.on("SIGTERM", async () => {
  const state = await waitForChildShutdown(child, "SIGTERM");
  await shutdownAndExit(state.exitCode ?? 143, state);
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

child.on("error", async () => {
  skipContainerTeardown = true;
  const state = await waitForChildShutdown(child, "SIGTERM", 5_000);
  await shutdownAndExit(1, state);
});

child.on("close", async (code) => {
  await shutdownAndExit(code ?? 1, { closed: true, timedOut: false });
});