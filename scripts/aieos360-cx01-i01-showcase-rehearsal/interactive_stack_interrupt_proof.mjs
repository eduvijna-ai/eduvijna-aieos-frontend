#!/usr/bin/env node
/**
 * Real interactive start.mjs stack: SIGINT during readiness and after full ready.
 * Requires AIEOS_BACKEND_ROOT and governed database substrate (integration).
 */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { isPidAlive } from "./process_registry.mjs";
import { canonicalStop, runNodeSync } from "./proof_orchestration.mjs";
import { processesPath, statusPath, tmpDir, repoRoot } from "./paths.mjs";

const scriptDir = join(repoRoot, "scripts/aieos360-cx01-i01-showcase-rehearsal");
const backendRoot = process.env.AIEOS_BACKEND_ROOT;
if (!backendRoot) {
  console.error("AIEOS_BACKEND_ROOT is required");
  process.exit(1);
}

mkdirSync(tmpDir, { recursive: true });

const MARKER_READINESS = "CX01_STACK_READINESS_PHASE";
const MARKER_READY = "CX01_STACK_FULLY_READY";

const cases = [];

function spawnInteractiveStack(extraEnv = {}) {
  return spawn(process.execPath, [join(scriptDir, "start.mjs")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      AIEOS360_CX01_I01_SHOWCASE_SKIP_RESET: "1",
      AIEOS360_CX01_I01_SHOWCASE_STOP_EXPECT_CONTAINER: "0",
      AIEOS360_CX01_I01_SHOWCASE_START_MODE: "interactive",
      AIEOS360_CX01_I01_SHOWCASE_STACK_INTERRUPT_PROOF: "1",
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function waitForStdoutMarker(child, marker, timeoutMs = 600_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`marker timeout: ${marker}`)),
      timeoutMs,
    );
    const onData = (chunk) => {
      if (String(chunk).includes(marker)) {
        clearTimeout(timer);
        child.stdout?.off("data", onData);
        resolve();
      }
    };
    child.stdout?.on("data", onData);
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      reject(new Error(`exited before ${marker}: code=${code} signal=${signal}`));
    });
  });
}

async function waitForTerminalStatus(timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const status = JSON.parse(readFileSync(statusPath, "utf8"));
      if (status.phase === "stopped" || status.phase === "stop_failed") {
        return status;
      }
    } catch {
      /* not yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("terminal status timeout");
}

async function runCase(name, fn) {
  canonicalStop();
  await new Promise((resolve) => setTimeout(resolve, 300));
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
  const reset = runNodeSync("reset.mjs", {}, 600_000);
  if (reset.status !== 0) {
    throw new Error(`reset failed: ${reset.status}`);
  }

  await runCase("sigint_during_readiness", async () => {
    const child = spawnInteractiveStack();
    const exitPromise = new Promise((resolve) => {
      child.once("exit", (code, signal) => resolve({ code, signal }));
    });
    await waitForStdoutMarker(child, MARKER_READINESS);
    child.kill("SIGINT");
    const exit = await exitPromise;
    const status = await waitForTerminalStatus();
    if (status.phase !== "stopped" && status.phase !== "stop_failed") {
      throw new Error(`unexpected phase ${status.phase}`);
    }
    const registry = JSON.parse(readFileSync(processesPath, "utf8"));
    const alive = (registry.children ?? []).filter((e) => isPidAlive(e.pid));
    if (alive.length > 0) {
      throw new Error(`owned children still alive: ${alive.map((e) => e.pid)}`);
    }
    if (exit.code !== 0 && exit.signal !== "SIGINT") {
      throw new Error(`unexpected exit code=${exit.code} signal=${exit.signal}`);
    }
  });

  await runCase("sigint_after_full_ready", async () => {
    const child = spawnInteractiveStack();
    const exitPromise = new Promise((resolve) => {
      child.once("exit", (code, signal) => resolve({ code, signal }));
    });
    await waitForStdoutMarker(child, MARKER_READY, 900_000);
    child.kill("SIGINT");
    const exit = await exitPromise;
    const status = await waitForTerminalStatus();
    if (status.phase !== "stopped") {
      throw new Error(`expected stopped after ready interrupt, got ${status.phase}`);
    }
    if (exit.code !== 0 && exit.signal !== "SIGINT") {
      throw new Error(`unexpected exit code=${exit.code} signal=${exit.signal}`);
    }
  });
} catch {
  const proof = {
    classification: "NON_PRODUCTION",
    path: "interactive_stack_interrupt",
    platform: process.platform,
    cases,
    note: "Real eight-service interactive start.mjs; Linux integration only.",
  };
  writeFileSync(
    join(tmpDir, "aieos360-cx01-i01-showcase-stack-interrupt-proof.json"),
    JSON.stringify(proof, null, 2) + "\n",
    "utf8",
  );
  console.error(JSON.stringify(proof, null, 2));
  canonicalStop();
  process.exit(1);
}

const proof = {
  classification: "NON_PRODUCTION",
  path: "interactive_stack_interrupt",
  platform: process.platform,
  cases,
  real_stack_interactive: true,
  note: "Handlers installed before ports/reset/spawn; Linux CI integration only.",
};
writeFileSync(
  join(tmpDir, "aieos360-cx01-i01-showcase-stack-interrupt-proof.json"),
  JSON.stringify(proof, null, 2) + "\n",
  "utf8",
);
console.log(JSON.stringify(proof, null, 2));
