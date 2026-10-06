#!/usr/bin/env node
import { spawn } from "node:child_process";
import { waitForAllPidsExit } from "./process_tree.mjs";

const children = [];
for (let i = 0; i < 3; i += 1) {
  const child = spawn(process.execPath, ["-e", "setTimeout(()=>{}, 30000)"], {
    stdio: "ignore",
  });
  children.push(child.pid);
}

const start = Date.now();
const waitResult = await waitForAllPidsExit(children, 500);
const elapsed = Date.now() - start;

for (const pid of children) {
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    /* ignore */
  }
}

if (waitResult.allExited) {
  console.error("expected children to remain alive within 500ms grace");
  process.exit(1);
}
if (elapsed > 2_000) {
  console.error(`shared grace exceeded budget: ${elapsed}ms`);
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, elapsed_ms: elapsed, alive: waitResult.alive.length }));
