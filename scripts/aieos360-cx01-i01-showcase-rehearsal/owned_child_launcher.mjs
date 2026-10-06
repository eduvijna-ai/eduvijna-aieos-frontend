#!/usr/bin/env node
/**
 * Launches an owned child with a verifiable ownership token (env + argv on all platforms).
 */
import { spawn } from "node:child_process";
import { CHILD_OWNERSHIP_ENV, PARENT_RUN_ENV } from "./process_identity.mjs";

const ownershipToken = process.argv[2];
const scriptPath = process.argv[3];
const scriptArgs = process.argv.slice(4);

if (!ownershipToken || !scriptPath) {
  console.error("owned_child_launcher requires <token> <script> [args...]");
  process.exit(1);
}

const env = {
  ...process.env,
  [CHILD_OWNERSHIP_ENV]: ownershipToken,
};
if (!env[PARENT_RUN_ENV]) {
  env[PARENT_RUN_ENV] = process.env[PARENT_RUN_ENV] ?? "";
}

const child = spawn(process.execPath, [scriptPath, ...scriptArgs], {
  env,
  stdio: "inherit",
  detached: false,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
