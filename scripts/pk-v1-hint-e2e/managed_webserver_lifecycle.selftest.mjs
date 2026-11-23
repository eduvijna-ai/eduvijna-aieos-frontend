#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  GOVERNED_LOCAL_PORTS,
  allowDatabaseTeardownAfterWebservers,
  governedLocalPorts,
  verifyGovernedWebserversReleased,
} from "./managed_webserver_lifecycle.mjs";

const probeFactory = (portStates) => ({
  async probePort(_host, port) {
    return portStates.get(port) ?? "UNKNOWN";
  },
});

assert.deepEqual(governedLocalPorts(), [...GOVERNED_LOCAL_PORTS]);

const allClosed = await verifyGovernedWebserversReleased(
  probeFactory(new Map(GOVERNED_LOCAL_PORTS.map((p) => [p, "CLOSED"]))),
);
assert.equal(allClosed.released, true);
assert.equal(allClosed.ambiguous, false);
assert.equal(allowDatabaseTeardownAfterWebservers(allClosed), true);

const oneListening = await verifyGovernedWebserversReleased(
  probeFactory(
    new Map([
      [8028, "LISTENING"],
      [8029, "CLOSED"],
      [5191, "CLOSED"],
      [5192, "CLOSED"],
    ]),
  ),
);
assert.equal(oneListening.released, false);
assert.deepEqual(oneListening.occupiedPorts, [8028]);
assert.equal(allowDatabaseTeardownAfterWebservers(oneListening), false);

const timeoutUnknown = await verifyGovernedWebserversReleased(
  probeFactory(
    new Map([
      [8028, "UNKNOWN"],
      [8029, "CLOSED"],
      [5191, "CLOSED"],
      [5192, "CLOSED"],
    ]),
  ),
  "127.0.0.1",
  { maxRetries: 0 },
);
assert.deepEqual(timeoutUnknown.unknownPorts, [8028]);
assert.equal(timeoutUnknown.released, false);
assert.equal(allowDatabaseTeardownAfterWebservers(timeoutUnknown), false);

const eaccesUnknown = await verifyGovernedWebserversReleased(
  probeFactory(new Map(GOVERNED_LOCAL_PORTS.map((p) => [p, p === 5192 ? "UNKNOWN" : "CLOSED"]))),
  "127.0.0.1",
  { maxRetries: 0 },
);
assert.deepEqual(eaccesUnknown.unknownPorts, [5192]);

const lingering = new Map([[8029, 2]]);
const lateRelease = await verifyGovernedWebserversReleased(
  {
    async probePort(_host, port) {
      const remain = lingering.get(port) ?? 0;
      if (remain > 0) {
        lingering.set(port, remain - 1);
        return "LISTENING";
      }
      return "CLOSED";
    },
  },
  "127.0.0.1",
  { maxRetries: 4, retryDelayMs: 1 },
);
assert.equal(lateRelease.released, true);

const nonLoopback = await verifyGovernedWebserversReleased(
  probeFactory(new Map(GOVERNED_LOCAL_PORTS.map((p) => [p, "CLOSED"]))),
  "0.0.0.0",
);
assert.equal(nonLoopback.ambiguous, true);
assert.equal(allowDatabaseTeardownAfterWebservers(nonLoopback), false);

assert.equal(allowDatabaseTeardownAfterWebservers({ released: false, ambiguous: true }), false);

console.log(JSON.stringify({ managed_webserver_lifecycle_selftest: "ok" }));