#!/usr/bin/env node
/** Resistant child tree for interactive start.mjs signal-proof harness only. */
import { spawn } from "node:child_process";

for (let i = 0; i < 2; i += 1) {
  spawn(
    process.execPath,
    ["-e", "process.on('SIGTERM',()=>{});setInterval(()=>{},1_000_000)"],
    { env: process.env, stdio: "ignore", detached: false },
  );
}

process.on("SIGTERM", () => {});
setInterval(() => {}, 1_000_000);
