#!/usr/bin/env node
/** Late token-owned descendant spawned on SIGTERM must be discovered before stop completes. */
import { spawn } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { executeCanonicalShutdown } from "./canonical_shutdown.mjs";
import {
  buildChildRegistryEntry,
  CHILD_OWNERSHIP_ENV,
  newChildOwnershipToken,
  newParentRunId,
} from "./process_identity.mjs";
import { isPidAlive, writeProcessRegistry } from "./process_registry.mjs";
import { tmpDir } from "./paths.mjs";

function killTracked(pids) {
  for (const pid of pids) {
    if (!pid || !isPidAlive(pid)) {
      continue;
    }
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* ignore */
    }
  }
}

function findTokenPidsAlive(token) {
  const marker = `${CHILD_OWNERSHIP_ENV}=${token}`;
  const alive = [];
  if (process.platform !== "linux") {
    return alive;
  }
  for (const name of readdirSync("/proc")) {
    if (!/^\d+$/.test(name)) {
      continue;
    }
    const pid = Number(name);
    if (!isPidAlive(pid)) {
      continue;
    }
    try {
      const env = readFileSync(`/proc/${pid}/environ`).toString("utf8");
      if (env.includes(marker)) {
        alive.push(pid);
      }
    } catch {
      /* ignore */
    }
  }
  return alive;
}

mkdirSync(tmpDir, { recursive: true });

const token = newChildOwnershipToken();
const parentRunId = newParentRunId();
const tracked = [];

try {
  const lateSpawnScript =
    "process.on('SIGTERM',()=>{" +
    "require('node:child_process').spawn(process.execPath," +
    "['-e',\"process.on('SIGTERM',()=>{});setInterval(()=>{},1e6)\"]," +
    "{env:process.env,stdio:'ignore',detached:false});" +
    "});setInterval(()=>{},1e6);";

  const root = spawn(process.execPath, ["-e", lateSpawnScript], {
    env: { ...process.env, [CHILD_OWNERSHIP_ENV]: token },
    stdio: "ignore",
    detached: false,
  });
  tracked.push(root.pid);
  await new Promise((resolve) => setTimeout(resolve, 400));

  const entry = buildChildRegistryEntry({
    script: "late-spawn-root",
    role: "teacher-backend",
    pid: root.pid,
    parentRunId,
    ownershipToken: token,
  });
  writeProcessRegistry({ children: [entry], parentRunId });

  const shutdown = await executeCanonicalShutdown({
    expectContainer: false,
    treeGraceMs: 800,
    treeKillMs: 8_000,
  });

  const tokenAlive = findTokenPidsAlive(token);
  if (shutdown.phase !== "stopped" || tokenAlive.length > 0) {
    console.error(
      JSON.stringify({ shutdown_phase: shutdown.phase, tokenAlive }, null, 2),
    );
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, late_spawn_discovered: true }));
} finally {
  killTracked(tracked);
  killTracked(findTokenPidsAlive(token));
  writeProcessRegistry({ children: [] });
}
