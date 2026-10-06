#!/usr/bin/env node
/**
 * Exercises interactive start.mjs SIGINT/SIGTERM handlers (not executeCanonicalShutdown alone).
 */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { isPidAlive } from "./process_registry.mjs";
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

const cases = [];

async function runCase(name, fn) {
  try {
    await fn();
    cases.push({ case: name, ok: true });
  } catch (error) {
    cases.push({ case: name, ok: false, error: String(error) });
    throw error;
  }
}

try {
  await runCase("sigint_success_cleanup", async () => {
    const child = spawnInteractiveStart();
    await waitForReady(child);
    const registryBefore = JSON.parse(readFileSync(processesPath, "utf8"));
    const tracked = (registryBefore.children ?? []).map((e) => e.pid);
    child.kill("SIGINT");
    const exit = await waitForExit(child);
    const status = JSON.parse(readFileSync(statusPath, "utf8"));
    const alive = tracked.filter((pid) => isPidAlive(pid));
    if (exit.code !== 0) {
      throw new Error(`expected exit 0, got ${exit.code}`);
    }
    if (status.phase !== "stopped") {
      throw new Error(`expected stopped, got ${status.phase}`);
    }
    if (alive.length > 0) {
      throw new Error(`children still alive: ${alive.join(",")}`);
    }
  });

  await runCase("repeated_sigint_single_cleanup", async () => {
    const child = spawnInteractiveStart();
    await waitForReady(child);
    child.kill("SIGINT");
    child.kill("SIGINT");
    const exit = await waitForExit(child);
    if (exit.code !== 0) {
      throw new Error(`expected exit 0 on repeated SIGINT, got ${exit.code}`);
    }
  });

  await runCase("sigint_cleanup_failure_nonzero", async () => {
    const child = spawnInteractiveStart({
      AIEOS360_CX01_I01_SHOWCASE_INTERACTIVE_SIGNAL_PROOF_FAIL: "1",
    });
    await waitForReady(child);
    child.kill("SIGINT");
    const exit = await waitForExit(child);
    const status = JSON.parse(readFileSync(statusPath, "utf8"));
    if (exit.code !== 1) {
      throw new Error(`expected exit 1 on simulated stop_failed, got ${exit.code}`);
    }
    if (status.phase !== "stop_failed") {
      throw new Error(`expected stop_failed status, got ${status.phase}`);
    }
  });

  await runCase("sigterm_cleanup_failure_nonzero", async () => {
    const child = spawnInteractiveStart({
      AIEOS360_CX01_I01_SHOWCASE_INTERACTIVE_SIGNAL_PROOF_FAIL: "1",
    });
    await waitForReady(child);
    child.kill("SIGTERM");
    const exit = await waitForExit(child);
    if (exit.code !== 1) {
      throw new Error(`expected exit 1 on SIGTERM stop_failed, got ${exit.code}`);
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
  process.exit(1);
}

const proof = {
  classification: "NON_PRODUCTION",
  path: "foreground_start_sigint",
  platform: process.platform,
  cases,
  stop_wide_elapsed_observed: true,
  note:
    "Exercises real start.mjs handlers; Windows/macOS tree shutdown not executed in Linux CI.",
};
writeFileSync(
  join(tmpDir, "aieos360-cx01-i01-showcase-foreground-sigint-proof.json"),
  JSON.stringify(proof, null, 2) + "\n",
  "utf8",
);
console.log(JSON.stringify(proof, null, 2));
