#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { CX01_SHOWCASE_CONTAINER } from "./constants.mjs";
import { processesPath } from "./paths.mjs";

if (existsSync(processesPath)) {
  const { children } = JSON.parse(readFileSync(processesPath, "utf8"));
  for (const entry of children ?? []) {
    try {
      process.kill(entry.pid, "SIGTERM");
    } catch {
      /* ignore */
    }
  }
}

spawnSync("docker", ["rm", "-f", CX01_SHOWCASE_CONTAINER], {
  stdio: "inherit",
});

console.log(
  JSON.stringify(
    {
      stopped: true,
      classification: "NON_PRODUCTION",
      container_removed: CX01_SHOWCASE_CONTAINER,
    },
    null,
    2,
  ),
);
