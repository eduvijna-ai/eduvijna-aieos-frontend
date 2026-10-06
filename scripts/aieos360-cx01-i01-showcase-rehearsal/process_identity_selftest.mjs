#!/usr/bin/env node
/** Cross-platform process ownership self-test (no signals to foreign processes). */
import { spawn } from "node:child_process";
import {
  buildChildRegistryEntry,
  captureProcessBirthIdentity,
  CHILD_OWNERSHIP_ENV,
  newChildOwnershipToken,
  newParentRunId,
  verifyRegistryEntryOwnership,
} from "./process_identity.mjs";

function fail(message) {
  console.error(message);
  process.exit(1);
}

const token = newChildOwnershipToken();
const child = spawn(
  process.execPath,
  ["-e", "setInterval(()=>{}, 5000)"],
  {
    env: { ...process.env, [CHILD_OWNERSHIP_ENV]: token },
    stdio: "ignore",
    detached: true,
  },
);
child.unref();

await new Promise((resolve) => setTimeout(resolve, 300));

if (!child.pid) {
  fail("failed to spawn self-test child");
}

const entry = buildChildRegistryEntry({
  script: "selftest",
  role: "selftest",
  pid: child.pid,
  parentRunId: newParentRunId(),
  ownershipToken: token,
});

const ok = verifyRegistryEntryOwnership(child.pid, entry);
if (!ok.ok) {
  fail(`expected owned child to verify: ${ok.reason}`);
}

const birth = captureProcessBirthIdentity(child.pid);
if (!birth) {
  fail("captureProcessBirthIdentity returned null for live child");
}

const wrongEntry = buildChildRegistryEntry({
  script: "selftest",
  role: "selftest",
  pid: child.pid,
  parentRunId: newParentRunId(),
  ownershipToken: newChildOwnershipToken(),
});
const reject = verifyRegistryEntryOwnership(child.pid, wrongEntry);
if (reject.ok) {
  fail("expected wrong ownership token to be rejected");
}

try {
  process.kill(child.pid, "SIGKILL");
} catch {
  /* ignore */
}

console.log(
  JSON.stringify({
    ok: true,
    platform: process.platform,
    birth_platform: birth.platform,
  }),
);
