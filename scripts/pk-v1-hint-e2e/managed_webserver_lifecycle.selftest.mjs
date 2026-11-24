#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  GOVERNED_LOCAL_PORTS,
  allowDatabaseTeardownAfterWebservers,
  evaluateWebserverReleaseGate,
  governedLocalPorts,
  normalizePortProbeState,
  verifyGovernedWebserversReleased,
} from "./managed_webserver_lifecycle.mjs";

const probeFactory = (portStates) => ({
  async probePort(_host, port) {
    const state = portStates.get(port);
    if (state instanceof Error) {
      throw state;
    }
    if (typeof state === "function") {
      return state();
    }
    return state;
  },
});

assert.equal(normalizePortProbeState("CLOSED"), "CLOSED");
assert.equal(normalizePortProbeState("LISTENING"), "LISTENING");
assert.equal(normalizePortProbeState("UNKNOWN"), "UNKNOWN");
assert.equal(normalizePortProbeState(undefined), "UNKNOWN");
assert.equal(normalizePortProbeState(null), "UNKNOWN");
assert.equal(normalizePortProbeState("ERROR"), "UNKNOWN");

assert.deepEqual(governedLocalPorts(), [...GOVERNED_LOCAL_PORTS]);

const allClosed = await verifyGovernedWebserversReleased(
  probeFactory(new Map(GOVERNED_LOCAL_PORTS.map((p) => [p, "CLOSED"]))),
);
assert.equal(allClosed.released, true);
assert.equal(allClosed.ambiguous, false);
assert.equal(allowDatabaseTeardownAfterWebservers(allClosed), true);

const undefinedPort = await verifyGovernedWebserversReleased(
  probeFactory(
    new Map([
      [8028, undefined],
      [8029, "CLOSED"],
      [5191, "CLOSED"],
      [5192, "CLOSED"],
    ]),
  ),
  "127.0.0.1",
  { maxRetries: 0 },
);
assert.deepEqual(undefinedPort.unknownPorts, [8028]);

const nullPort = await verifyGovernedWebserversReleased(
  probeFactory(
    new Map([
      [8028, null],
      [8029, "CLOSED"],
      [5191, "CLOSED"],
      [5192, "CLOSED"],
    ]),
  ),
  "127.0.0.1",
  { maxRetries: 0 },
);
assert.deepEqual(nullPort.unknownPorts, [8028]);

const errorLiteral = await verifyGovernedWebserversReleased(
  probeFactory(
    new Map([
      [8028, "ERROR"],
      [8029, "CLOSED"],
      [5191, "CLOSED"],
      [5192, "CLOSED"],
    ]),
  ),
  "127.0.0.1",
  { maxRetries: 0 },
);
assert.deepEqual(errorLiteral.unknownPorts, [8028]);

const rejectedProbe = await verifyGovernedWebserversReleased(
  probeFactory(new Map(GOVERNED_LOCAL_PORTS.map((p) => [p, new Error("probe failed")]))),
  "127.0.0.1",
  { maxRetries: 0 },
);
assert.equal(rejectedProbe.released, false);
assert.deepEqual(rejectedProbe.unknownPorts, [...GOVERNED_LOCAL_PORTS]);

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

const childClosedAmbiguous = await evaluateWebserverReleaseGate(
  { closed: true },
  probeFactory(new Map([[8028, "UNKNOWN"], [8029, "CLOSED"], [5191, "CLOSED"], [5192, "CLOSED"]])),
);
assert.equal(childClosedAmbiguous.lifecycleUncertain, true);
assert.equal(childClosedAmbiguous.reason, "WEBSERVER_PORT_UNKNOWN");

const childNotClosed = await evaluateWebserverReleaseGate({ closed: false });
assert.equal(childNotClosed.lifecycleUncertain, true);
assert.equal(childNotClosed.reason, "CHILD_NOT_CLOSED");

assert.equal(allowDatabaseTeardownAfterWebservers({ released: false, ambiguous: true }), false);

console.log(JSON.stringify({ managed_webserver_lifecycle_selftest: "ok" }));