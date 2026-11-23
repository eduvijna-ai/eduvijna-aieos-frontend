#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  allowDatabaseTeardownAfterWebservers,
  verifyGovernedWebserversReleased,
} from "./managed_webserver_lifecycle.mjs";

const allFree = await verifyGovernedWebserversReleased({
  async isPortListening() {
    return false;
  },
});
assert.equal(allFree.released, true);
assert.equal(allowDatabaseTeardownAfterWebservers(allFree), true);

const oneBusy = await verifyGovernedWebserversReleased({
  async isPortListening(_host, port) {
    return port === 8028;
  },
});
assert.equal(oneBusy.released, false);
assert.deepEqual(oneBusy.occupiedPorts, [8028]);
assert.equal(allowDatabaseTeardownAfterWebservers(oneBusy), false);

const ambiguous = { released: false, ambiguous: true };
assert.equal(allowDatabaseTeardownAfterWebservers(ambiguous), false);

console.log(JSON.stringify({ managed_webserver_lifecycle_selftest: "ok" }));