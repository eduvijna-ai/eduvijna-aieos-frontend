#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  PK_V1_HINT_DOCKER_OWNER_LABEL,
  PK_V1_HINT_DOCKER_PACKAGE_LABEL,
  classifyDockerInspectResult,
} from "./docker_inspect.mjs";
import {
  evaluateDestructionPermission,
  evaluateNamedContainerStartRefusal,
  evaluateUnownedMutationRefusal,
  verifyLoopbackPortBinding,
} from "./docker_ownership_policy.mjs";

function payloadForPort(hostPort) {
  return [
    {
      Id: "abc123container",
      Config: {
        Image: "postgres:18",
        Labels: {
          [PK_V1_HINT_DOCKER_OWNER_LABEL]: "owner-run",
          [PK_V1_HINT_DOCKER_PACKAGE_LABEL]: "pk-v1-hint-e2e",
        },
      },
      HostConfig: {
        PortBindings: {
          "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: String(hostPort) }],
        },
      },
    },
  ];
}

function testLoopbackBinding() {
  const ok = verifyLoopbackPortBinding(payloadForPort("55439"), "55439");
  assert.equal(ok.ok, true);
  const wide = verifyLoopbackPortBinding(
    [
      {
        HostConfig: {
          PortBindings: { "5432/tcp": [{ HostIp: "0.0.0.0", HostPort: "55439" }] },
        },
      },
    ],
    "55439",
  );
  assert.equal(wide.ok, false);
  const dual = verifyLoopbackPortBinding(
    [
      {
        HostConfig: {
          PortBindings: {
            "5432/tcp": [
              { HostIp: "127.0.0.1", HostPort: "55439" },
              { HostIp: "0.0.0.0", HostPort: "55439" },
            ],
          },
        },
      },
    ],
    "55439",
  );
  assert.equal(dual.ok, false);
}

function testForeignMutationRefused() {
  const inspect = classifyDockerInspectResult({
    status: 0,
    stdout: JSON.stringify([
      {
        Id: "foreign",
        Config: { Image: "postgres:18", Labels: {} },
        HostConfig: { PortBindings: {} },
      },
    ]),
    stderr: "",
  });
  const decision = evaluateUnownedMutationRefusal(inspect, null, "pk-v1-hint-e2e");
  assert.equal(decision.action, "refuse");
  assert.equal(decision.code, "FOREIGN_CONTAINER");
}

function testStaleOwnerRecordRefused() {
  const inspect = classifyDockerInspectResult({
    status: 0,
    stdout: JSON.stringify(payloadForPort("55439")),
    stderr: "",
  });
  const permission = evaluateDestructionPermission({
    inspect,
    record: { containerId: "other-id", ownerRunId: "owner-run", hostPort: "55439" },
    expectedHostPort: "55439",
    inspectPayload: payloadForPort("55439"),
  });
  assert.equal(permission.ok, false);
  assert.equal(permission.code, "CONTAINER_ID_MISMATCH");
}

function testMissingOwnerRunIdRefused() {
  const inspect = classifyDockerInspectResult({
    status: 0,
    stdout: JSON.stringify(payloadForPort("55440")),
    stderr: "",
  });
  const permission = evaluateDestructionPermission({
    inspect,
    record: { containerId: "abc123container", hostPort: "55440" },
    expectedHostPort: "55440",
    inspectPayload: payloadForPort("55440"),
  });
  assert.equal(permission.ok, false);
  assert.equal(permission.code, "MISSING_OWNER_RUN_ID");
}

function testOwnedDestructionPermitted() {
  const inspect = classifyDockerInspectResult({
    status: 0,
    stdout: JSON.stringify(payloadForPort("55440")),
    stderr: "",
  });
  const permission = evaluateDestructionPermission({
    inspect,
    record: {
      containerId: "abc123container",
      ownerRunId: "owner-run",
      hostPort: "55440",
    },
    expectedHostPort: "55440",
    inspectPayload: payloadForPort("55440"),
  });
  assert.equal(permission.ok, true);
}

function testNamedExistingRefusesStart() {
  const inspect = classifyDockerInspectResult({
    status: 0,
    stdout: JSON.stringify(payloadForPort("55439")),
    stderr: "",
  });
  const decision = evaluateNamedContainerStartRefusal(inspect);
  assert.equal(decision.ok, false);
  assert.equal(decision.code, "NAMED_CONTAINER_ALREADY_EXISTS");
}

function testPrimaryProbePortIsolation() {
  const primary = verifyLoopbackPortBinding(payloadForPort("55439"), "55439");
  const probe = verifyLoopbackPortBinding(payloadForPort("55440"), "55440");
  assert.equal(primary.ok, true);
  assert.equal(probe.ok, true);
  assert.notEqual(primary.hostPort, probe.hostPort);
}

testLoopbackBinding();
testForeignMutationRefused();
testStaleOwnerRecordRefused();
testMissingOwnerRunIdRefused();
testOwnedDestructionPermitted();
testNamedExistingRefusesStart();
testPrimaryProbePortIsolation();
console.log(JSON.stringify({ docker_ownership_selftest: "ok" }));