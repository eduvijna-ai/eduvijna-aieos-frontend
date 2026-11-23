#!/usr/bin/env node
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  allowOwnedDatabaseTeardown,
  waitForChildShutdown,
  timeoutShutdownExitCode,
} from "./managed_child_lifecycle.mjs";

assert.equal(allowOwnedDatabaseTeardown({ closed: true, timedOut: false }), true);
assert.equal(allowOwnedDatabaseTeardown({ closed: false, timedOut: true }), false);

function fakeChild({ closeAfterMs = 10, exitCode = 0, ignoreSignal = false } = {}) {
  const child = new EventEmitter();
  child.exitCode = null;
  child.pid = 99999;
  child.kill = () => {
    if (ignoreSignal) {
      return true;
    }
    setTimeout(() => {
      child.exitCode = exitCode;
      child.emit("close", exitCode);
    }, closeAfterMs);
    return true;
  };
  return child;
}

const closed = await waitForChildShutdown(fakeChild(), "SIGTERM", 500);
assert.equal(closed.closed, true);
assert.equal(closed.exitCode, 0);

const stalled = await waitForChildShutdown(
  fakeChild({ ignoreSignal: true }),
  "SIGTERM",
  30,
);
assert.equal(stalled.timedOut, true);
assert.equal(stalled.closed, false);
assert.equal(stalled.exitCode, timeoutShutdownExitCode("SIGTERM"));
assert.equal(allowOwnedDatabaseTeardown(stalled), false);

console.log(JSON.stringify({ managed_child_lifecycle_selftest: "ok" }));