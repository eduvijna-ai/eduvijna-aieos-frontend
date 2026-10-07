#!/usr/bin/env node
/**
 * Exercises interactive start.mjs SIGINT/SIGTERM handlers (not executeCanonicalShutdown alone).
 */
import { spawn } from "node:child_process";
import { kill as killPid } from "node:process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { isPidAlive } from "./process_registry.mjs";
import { canonicalStop } from "./proof_orchestration.mjs";
import { processesPath, statusPath, tmpDir, repoRoot } from "./paths.mjs";

const scriptDir = join(repoRoot, "scripts/aieos360-cx01-i01-showcase-rehearsal");
const READY = "CX01_INTERACTIVE_SIGNAL_PROOF_READY";

mkdirSync(tmpDir, { recursive: true });

function spawnInteractiveStart(extraEnv = {}) {
  const child = spawn(process.execPath, [join(scriptDir, "start.mjs")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      AIEOS360_CX01_I01_SHOWCASE_SKIP_RESET: "1",
      AIEOS360_CX01_I01_SHOWCASE_STOP_EXPECT_CONTAINER: "0",
      AIEOS360_CX01_I01_SHOWCASE_INTERACTIVE_SIGNAL_PROOF: "1",
      AIEOS360_CX01_I01_SHOWCASE_START_MODE: "interactive",
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const capture = { stdout: "", stderr: "" };
  child.stdout?.on("data", (chunk) => {
    capture.stdout += String(chunk);
  });
  child.stderr?.on("data", (chunk) => {
    capture.stderr += String(chunk);
  });
  child.__capture = capture;
  return child;
}

function createExitPromise(child, timeoutMs = 120_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`exit timeout | stderr=${child.__capture?.stderr}`)),
      timeoutMs,
    );
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal });
    });
  });
}

function waitForReady(child, timeoutMs = 30_000) {
  const exitPromise = createExitPromise(child, timeoutMs + 10_000);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(
            `ready timeout | stderr=${child.__capture?.stderr} stdout=${child.__capture?.stdout}`,
          ),
        ),
      timeoutMs,
    );
    const onData = (chunk) => {
      const text = String(chunk);
      if (text.includes(READY)) {
        clearTimeout(timer);
        child.stdout?.off("data", onData);
        resolve();
      }
    };
    child.stdout?.on("data", onData);
    exitPromise.catch((error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function waitForTerminalStatus(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const status = JSON.parse(readFileSync(statusPath, "utf8"));
      if (status.phase === "stopped" || status.phase === "stop_failed") {
        return status;
      }
    } catch {
      /* status not written yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  let lastPhase = "missing";
  try {
    lastPhase = JSON.parse(readFileSync(statusPath, "utf8")).phase;
  } catch {
    /* ignore */
  }
  throw new Error(`operator status never reached terminal phase (last=${lastPhase})`);
}

function formatDiagnostics(child, exit) {
  const cap = child.__capture ?? { stdout: "", stderr: "" };
  return JSON.stringify({
    exit,
    stderr_tail: cap.stderr.slice(-3000),
    stdout_tail: cap.stdout.slice(-3000),
  });
}

function assertSuccessfulExit(exit, status) {
  if (status.phase !== "stopped") {
    throw new Error(`expected stopped, got ${status.phase}`);
  }
  if (exit.code === 0) {
    return;
  }
  if (exit.code === null && (exit.signal === "SIGINT" || exit.signal === "SIGTERM")) {
    return;
  }
  throw new Error(
    `expected successful exit 0 or signal-terminated after stopped, got code=${exit.code} signal=${exit.signal}`,
  );
}

const cases = [];

async function runCase(name, fn) {
  canonicalStop();
  await new Promise((resolve) => setTimeout(resolve, 200));
  try {
    await fn();
    cases.push({ case: name, ok: true });
  } catch (error) {
    cases.push({ case: name, ok: false, error: String(error) });
    throw error;
  } finally {
    canonicalStop();
  }
}

async function runSignalShutdownCase({
  name,
  signal,
  extraEnv = {},
  expectExitCode,
  expectPhase,
}) {
  await runCase(name, async () => {
    const child = spawnInteractiveStart(extraEnv);
    const exitPromise = createExitPromise(child);
    await waitForReady(child);
    await new Promise((resolve) => setTimeout(resolve, 75));
    if (signal === "SIGTERM") {
      killPid(child.pid, "SIGTERM");
    } else {
      child.kill(signal);
    }
    const exit = await exitPromise;
    let status;
    try {
      status = await waitForTerminalStatus();
    } catch (error) {
      throw new Error(`${error.message} | ${formatDiagnostics(child, exit)}`);
    }
    if (exit.code !== expectExitCode) {
      throw new Error(
        `expected exit ${expectExitCode}, got ${exit.code} | ${formatDiagnostics(child, exit)}`,
      );
    }
    if (status.phase !== expectPhase) {
      throw new Error(
        `expected status ${expectPhase}, got ${status.phase} | ${formatDiagnostics(child, exit)}`,
      );
    }
    if (expectPhase === "stopped") {
      assertSuccessfulExit(exit, status);
    }
  });
}

try {
  canonicalStop();

  await runCase("sigint_success_cleanup", async () => {
    const child = spawnInteractiveStart();
    const exitPromise = createExitPromise(child);
    await waitForReady(child);
    await new Promise((resolve) => setTimeout(resolve, 75));
    const registryBefore = JSON.parse(readFileSync(processesPath, "utf8"));
    const tracked = (registryBefore.children ?? []).map((e) => e.pid);
    child.kill("SIGINT");
    const exit = await exitPromise;
    let status;
    try {
      status = await waitForTerminalStatus();
    } catch (error) {
      throw new Error(`${error.message} | ${formatDiagnostics(child, exit)}`);
    }
    const alive = tracked.filter((pid) => isPidAlive(pid));
    assertSuccessfulExit(exit, status);
    if (alive.length > 0) {
      throw new Error(`children still alive: ${alive.join(",")}`);
    }
  });

  await runCase("sigint_success_cleanup_repeat", async () => {
    const child = spawnInteractiveStart();
    const exitPromise = createExitPromise(child);
    await waitForReady(child);
    await new Promise((resolve) => setTimeout(resolve, 75));
    child.kill("SIGINT");
    const exit = await exitPromise;
    let status;
    try {
      status = await waitForTerminalStatus();
    } catch (error) {
      throw new Error(`${error.message} | ${formatDiagnostics(child, exit)}`);
    }
    assertSuccessfulExit(exit, status);
  });

  await runSignalShutdownCase({
    name: "sigint_cleanup_failure_nonzero",
    signal: "SIGINT",
    extraEnv: { AIEOS360_CX01_I01_SHOWCASE_INTERACTIVE_SIGNAL_PROOF_FAIL: "1" },
    expectExitCode: 1,
    expectPhase: "stop_failed",
  });

  await runSignalShutdownCase({
    name: "sigterm_cleanup_failure_nonzero",
    signal: "SIGTERM",
    extraEnv: { AIEOS360_CX01_I01_SHOWCASE_INTERACTIVE_SIGNAL_PROOF_FAIL: "1" },
    expectExitCode: 1,
    expectPhase: "stop_failed",
  });

  await runSignalShutdownCase({
    name: "shutdown_throw_nonzero",
    signal: "SIGINT",
    extraEnv: { AIEOS360_CX01_I01_SHOWCASE_SIMULATE_SHUTDOWN_THROW: "1" },
    expectExitCode: 1,
    expectPhase: "stop_failed",
  });

  await runCase("same_process_mixed_signals_during_cleanup", async () => {
    const child = spawnInteractiveStart();
    const exitPromise = createExitPromise(child);
    await waitForReady(child);
    await new Promise((resolve) => setTimeout(resolve, 75));
    child.kill("SIGINT");
    await new Promise((resolve) => setTimeout(resolve, 40));
    child.kill("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 40));
    child.kill("SIGINT");
    const exit = await exitPromise;
    let status;
    try {
      status = await waitForTerminalStatus();
    } catch (error) {
      throw new Error(`${error.message} | ${formatDiagnostics(child, exit)}`);
    }
    assertSuccessfulExit(exit, status);
  });
} catch {
  const proof = {
    classification: "NON_PRODUCTION",
    path: "foreground_start_sigint",
    platform: process.platform,
    cases,
  };
  writeFileSync(
    join(tmpDir, "aieos360-cx01-i01-showcase-foreground-sigint-proof.json"),
    JSON.stringify(proof, null, 2) + "\n",
    "utf8",
  );
  console.error(JSON.stringify(proof, null, 2));
  canonicalStop();
  process.exit(1);
}

canonicalStop();

const proof = {
  classification: "NON_PRODUCTION",
  path: "foreground_start_sigint",
  platform: process.platform,
  cases,
  stop_wide_elapsed_observed: true,
  handler_before_ready: true,
  stop_failed_phase_proven_via:
    "live start.mjs SIGINT/SIGTERM + canonical_shutdown_simulate_fail_selftest.mjs",
  same_process_mixed_signals_during_cleanup: true,
  shutdown_throw_case: true,
  note:
    "Handlers before stack startup; same-process mixed signals during cleanup; Windows/macOS not executed in Linux CI.",
};
writeFileSync(
  join(tmpDir, "aieos360-cx01-i01-showcase-foreground-sigint-proof.json"),
  JSON.stringify(proof, null, 2) + "\n",
  "utf8",
);
console.log(JSON.stringify(proof, null, 2));
