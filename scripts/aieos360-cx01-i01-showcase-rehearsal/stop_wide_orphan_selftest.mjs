#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
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

mkdirSync(tmpDir, { recursive: true });

const token = newChildOwnershipToken();
const parentRunId = newParentRunId();
const tracked = [];

try {
  const supervisor = spawn(
    process.execPath,
    [
      "-e",
      "const {spawn}=require('node:child_process');" +
        "spawn(process.execPath,['-e',\"process.on('SIGTERM',()=>{});setInterval(()=>{},1e6)\"],{env:process.env,stdio:'ignore'});" +
        "setInterval(()=>{},1e6);",
    ],
    {
      env: { ...process.env, [CHILD_OWNERSHIP_ENV]: token },
      stdio: "ignore",
      detached: false,
    },
  );
  tracked.push(supervisor.pid);
  await new Promise((resolve) => setTimeout(resolve, 400));

  const entry = buildChildRegistryEntry({
    script: "orphan-root-test",
    role: "teacher-backend",
    pid: supervisor.pid,
    parentRunId,
    ownershipToken: token,
  });

  try {
    process.kill(supervisor.pid, "SIGKILL");
  } catch {
    /* ignore */
  }
  await new Promise((resolve) => setTimeout(resolve, 200));

  writeProcessRegistry({ children: [entry], parentRunId });

  const shutdown = await executeCanonicalShutdown({
    expectContainer: false,
    treeGraceMs: 500,
    treeKillMs: 5_000,
  });

  const tokenPids = (shutdown.status?.descendant_exit_records ?? [])
    .flatMap((record) => record.descendant_exit ?? [])
    .map((row) => row.pid);
  const survivors = tokenPids.filter((pid) => isPidAlive(pid));

  if (shutdown.phase !== "stopped" || survivors.length > 0) {
    console.error(JSON.stringify({ shutdown, survivors }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, dead_root_orphan_cleanup: true }));
} finally {
  killTracked(tracked);
  writeProcessRegistry({ children: [] });
}
