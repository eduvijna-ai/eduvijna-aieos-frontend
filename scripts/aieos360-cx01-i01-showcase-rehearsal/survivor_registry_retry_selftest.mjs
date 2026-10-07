#!/usr/bin/env node
/** Recoverable survivor registry entries must verify on retry stop. */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { executeCanonicalShutdown } from "./canonical_shutdown.mjs";
import {
  buildChildRegistryEntry,
  buildSurvivorRegistryEntry,
  CHILD_OWNERSHIP_ENV,
  newChildOwnershipToken,
  newParentRunId,
  verifyRegistryEntryOwnership,
} from "./process_identity.mjs";
import { isPidAlive, readProcessRegistry, writeProcessRegistry } from "./process_registry.mjs";
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
  const survivor = spawn(
    process.execPath,
    ["-e", "process.on('SIGTERM',()=>{});setInterval(()=>{},1e6)"],
    {
      env: { ...process.env, [CHILD_OWNERSHIP_ENV]: token },
      stdio: "ignore",
      detached: false,
    },
  );
  tracked.push(survivor.pid);
  await new Promise((resolve) => setTimeout(resolve, 300));

  const rootEntry = buildChildRegistryEntry({
    script: "survivor-retry-root",
    role: "teacher-backend",
    pid: survivor.pid + 99_999,
    parentRunId,
    ownershipToken: token,
  });
  const survivorEntry = buildSurvivorRegistryEntry(rootEntry, survivor.pid);

  const verify = verifyRegistryEntryOwnership(survivorEntry.pid, survivorEntry);
  if (!verify.ok) {
    console.error(JSON.stringify({ verify, survivorEntry }, null, 2));
    process.exit(1);
  }

  writeProcessRegistry({ children: [survivorEntry], parentRunId });

  const first = await executeCanonicalShutdown({
    expectContainer: false,
    treeGraceMs: 500,
    treeKillMs: 6_000,
  });

  const afterFirst = readProcessRegistry();
  const stillAlive = (afterFirst.children ?? []).filter((entry) =>
    isPidAlive(entry.pid),
  );

  if (first.phase !== "stopped" || stillAlive.length > 0 || isPidAlive(survivor.pid)) {
    console.error(
      JSON.stringify(
        { first, stillAlive, survivor_alive: isPidAlive(survivor.pid) },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, survivor_retry_identity: true }));
} finally {
  killTracked(tracked);
  writeProcessRegistry({ children: [] });
}
