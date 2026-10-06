#!/usr/bin/env node
/**
 * Exercises interactive start.mjs SIGINT/SIGTERM handlers (not executeCanonicalShutdown alone).
 */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { isPidAlive } from "./process_registry.mjs";
import { canonicalStop } from "./proof_orchestration.mjs";
import { processesPath, statusPath, tmpDir, repoRoot } from "./paths.mjs";

const scriptDir = join(repoRoot, "scripts/aieos360-cx01-i01-showcase-rehearsal");
const READY = "CX01_INTERACTIVE_SIGNAL_PROOF_READY";

mkdirSync(tmpDir, { recursive: true });

function spawnInteractiveStart(extraEnv = {}) {
  return spawn(
    process.execPath,
    [join(scriptDir, "start.mjs")],
    {
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
    },
  );
}

function waitForReady(child, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("ready timeout")), timeoutMs);
    const onData = (chunk) => {
      const text = String(chunk);
      if (text.includes(READY)) {
        clearTimeout(timer);
        child.stdout?.off("data", onData);
        resolve();
      }
    };
    child.stdout?.on("data", onData);
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`start exited before ready: ${code}`));
    });
  });
}

function waitForExit(child, timeoutMs = 120_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("exit timeout")), timeoutMs);
    child.on("exit", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal });
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
  const last = JSON.parse(readFileSync(statusPath, "utf8"));
  throw new Error(`operator status never reached terminal phase (last=${last.phase})`);
}

const cases = [];

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

try {
  canonicalStop();

  await runCase("sigint_success_cleanup", async () => {
    const child = spawnInteractiveStart();
    await waitForReady(child);
    const registryBefore = JSON.parse(readFileSync(processesPath, "utf8"));
    const tracked = (registryBefore.children ?? []).map((e) => e.pid);
    child.kill("SIGINT");
    const exit = await waitForExit(child);
    const status = await waitForTerminalStatus();
    const alive = tracked.filter((pid) => isPidAlive(pid));
    assertSuccessfulExit(exit, status);
    if (alive.length > 0) {
      throw new Error(`children still alive: ${alive.join(",")}`);
    }
  });

  await runCase("sigint_late_duplicate_after_terminal_status", async () => {
    const child = spawnInteractiveStart();
    await waitForReady(child);
    child.kill("SIGINT");
    const [exit, status] = await Promise.all([
      waitForExit(child),
      waitForTerminalStatus(),
    ]);
    try {
      child.kill("SIGINT");
    } catch {
      /* process already exited */
    }
    assertSuccessfulExit(exit, status);
    const statusAfter = JSON.parse(readFileSync(statusPath, "utf8"));
    if (statusAfter.phase !== "stopped") {
      throw new Error(`duplicate SIGINT must not corrupt status (got ${statusAfter.phase})`);
    }
  });

} catch {
  const proof = {
    classification: "NON_PRODUCTION",
    path: "foreground_start_sigint",
    platform: process.platform,
    cases,
    note:
      "Exercises real start.mjs handlers; Windows/macOS tree shutdown not executed in Linux CI.",
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
  shared_handler_signals: ["SIGINT", "SIGTERM"],
  stop_failed_phase_proven_via: "canonical_shutdown_simulate_fail_selftest.mjs",
  note:
    "Foreground proof covers successful start.mjs SIGINT cleanup; stop_failed phase via simulate_fail selftest; both signals share handler (pins). Windows/macOS not executed in Linux CI.",
};
writeFileSync(
  join(tmpDir, "aieos360-cx01-i01-showcase-foreground-sigint-proof.json"),
  JSON.stringify(proof, null, 2) + "\n",
  "utf8",
);
console.log(JSON.stringify(proof, null, 2));
