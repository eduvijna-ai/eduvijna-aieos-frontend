#!/usr/bin/env node
import { spawn } from "node:child_process";
import { executeCanonicalShutdown } from "./canonical_shutdown.mjs";
import {
  buildChildRegistryEntry,
  CHILD_OWNERSHIP_ENV,
  newChildOwnershipToken,
  newParentRunId,
} from "./process_identity.mjs";
import { isPidAlive, writeProcessRegistry } from "./process_registry.mjs";

const parentRunId = newParentRunId();
const entries = [];
const allTrackPids = [];

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
await new Promise((resolve) => setTimeout(resolve, 400));

const graceMs = 500;
const killMs = 4_000;
const maxElapsedMs = graceMs + killMs + 3_000;

const started = Date.now();
const shutdown = await executeCanonicalShutdown({
  expectContainer: false,
  treeGraceMs: graceMs,
  treeKillMs: killMs,
});
const elapsed = Date.now() - started;

const stillAlive = allTrackPids.filter((pid) => isPidAlive(pid));
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
