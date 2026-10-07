#!/usr/bin/env node
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

function listAliveWithMarkers(markers) {
  if (process.platform !== "linux") {
    return [];
  }
  const alive = [];
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
      if (markers.some((marker) => env.includes(marker))) {
        alive.push(pid);
      }
    } catch {
      /* ignore */
    }
  }
  return alive;
}

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

const parentRunId = newParentRunId();
const entries = [];
const allTrackPids = [];

try {
  for (let root = 0; root < 3; root += 1) {
    const token = newChildOwnershipToken();
    const supervisor = spawn(
      process.execPath,
      [
        "-e",
        "const {spawn}=require('node:child_process');" +
          "for (let i=0;i<2;i++) spawn(process.execPath,['-e',\"process.on('SIGTERM',()=>{});setInterval(()=>{},1e6)\"],{env:process.env,stdio:'ignore'});" +
          "process.on('SIGTERM',()=>{}); setInterval(()=>{},1e6);",
      ],
      {
        env: { ...process.env, [CHILD_OWNERSHIP_ENV]: token },
        stdio: "ignore",
        detached: false,
      },
    );
    allTrackPids.push(supervisor.pid);
    entries.push(
      buildChildRegistryEntry({
        script: `stop-wide-root-${root}`,
        role: `proof-root-${root}`,
        pid: supervisor.pid,
        parentRunId,
        ownershipToken: token,
      }),
    );
  }

  writeProcessRegistry({ children: entries, parentRunId });
  await new Promise((resolve) => setTimeout(resolve, 700));

  const graceMs = 600;
  const killMs = 8_000;
  const maxElapsedMs = graceMs + killMs + 4_000;

  const started = Date.now();
  const shutdown = await executeCanonicalShutdown({
    expectContainer: false,
    treeGraceMs: graceMs,
    treeKillMs: killMs,
  });
  const elapsed = Date.now() - started;

  const tokenMarkers = entries.map(
    (entry) => `${CHILD_OWNERSHIP_ENV}=${entry.ownershipToken}`,
  );
  const stillAlive = listAliveWithMarkers(tokenMarkers);
  const descendantRecords = shutdown.status?.descendant_exit_records ?? [];

  if (shutdown.phase !== "stopped") {
    console.error(JSON.stringify({ shutdown, stillAlive, elapsed }, null, 2));
    process.exit(1);
  }
  if (stillAlive.length > 0) {
    console.error(`survivors: ${stillAlive.join(",")}`);
    process.exit(1);
  }
  if (elapsed > maxElapsedMs) {
    console.error(
      `stop-wide exceeded budget: ${elapsed}ms > ${maxElapsedMs}ms (serialized roots would exceed)`,
    );
    process.exit(1);
  }
  if (descendantRecords.length < 3) {
    console.error("expected descendant_exit_records for each root");
    process.exit(1);
  }

  console.log(
    JSON.stringify({
      ok: true,
      elapsed_ms: elapsed,
      stop_wide_elapsed_ms: shutdown.stopWideElapsedMs,
      roots: 3,
      descendant_record_count: descendantRecords.length,
    }),
  );
} finally {
  killTracked(allTrackPids);
  killTracked(listAliveWithMarkers(
    entries.map((entry) => `${CHILD_OWNERSHIP_ENV}=${entry.ownershipToken}`),
  ));
  writeProcessRegistry({ children: [] });
}
