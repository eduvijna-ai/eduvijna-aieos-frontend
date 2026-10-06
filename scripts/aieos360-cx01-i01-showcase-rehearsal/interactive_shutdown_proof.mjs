#!/usr/bin/env node
/** Proves interactive shutdown path uses the same canonical bounded tree cleanup as stop.mjs. */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { executeCanonicalShutdown } from "./canonical_shutdown.mjs";
import {
  buildChildRegistryEntry,
  CHILD_OWNERSHIP_ENV,
  newChildOwnershipToken,
  newParentRunId,
} from "./process_identity.mjs";
import { isPidAlive, writeProcessRegistry } from "./process_registry.mjs";
import { statusPath, tmpDir } from "./paths.mjs";

mkdirSync(tmpDir, { recursive: true });

const token = newChildOwnershipToken();
const parentRunId = newParentRunId();
const supervisor = spawn(
  process.execPath,
  [
    "-e",
    "const {spawn}=require('node:child_process');" +
      "for (let i=0;i<3;i++) spawn(process.execPath,['-e',\"process.on('SIGTERM',()=>{});setInterval(()=>{},1e6)\"],{env:process.env,stdio:'ignore',detached:true});" +
      "process.on('SIGTERM',()=>{}); setInterval(()=>{},1e6);",
  ],
  {
    env: { ...process.env, [CHILD_OWNERSHIP_ENV]: token },
    stdio: "ignore",
    detached: true,
  },
);
supervisor.unref();
await new Promise((resolve) => setTimeout(resolve, 500));

const entry = buildChildRegistryEntry({
  script: "interactive-shutdown-supervisor",
  role: "teacher-backend",
  pid: supervisor.pid,
  parentRunId,
  ownershipToken: token,
});
writeProcessRegistry({ children: [entry] });

const shutdown = await executeCanonicalShutdown({ expectContainer: false });
const status = JSON.parse(readFileSync(statusPath, "utf8"));

const proof = {
  classification: "NON_PRODUCTION",
  path: "interactive_canonical_shutdown",
  shutdown_phase: shutdown.phase,
  operator_phase: status.phase,
  descendant_exit_records: status.descendant_exit_records ?? [],
  supervisor_alive_after: isPidAlive(supervisor.pid),
};
writeFileSync(
  join(tmpDir, "aieos360-cx01-i01-showcase-interactive-shutdown-proof.json"),
  JSON.stringify(proof, null, 2) + "\n",
  "utf8",
);

if (shutdown.phase !== "stopped" || proof.supervisor_alive_after) {
  console.error(JSON.stringify(proof, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(proof, null, 2));
