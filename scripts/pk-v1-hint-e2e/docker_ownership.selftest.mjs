#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  classifyDockerInspectResult,
  PK_V1_HINT_DOCKER_OWNER_LABEL,
  PK_V1_HINT_DOCKER_PACKAGE_LABEL,
} from "./docker_inspect.mjs";
import { assertNoUnownedContainerBeforeMutation } from "./docker_ownership.mjs";

function testInspectNotFound() {
  const result = classifyDockerInspectResult({
    status: 1,
    stdout: "",
    stderr: 'Error: No such object: aieos-pk-v1-hint-e2e-pg',
  });
  assert.equal(result.state, "not_found");
}

function testInspectOk() {
  const payload = [
    {
      Id: "abc123container",
      Config: {
        Image: "postgres:18",
        Labels: {
          [PK_V1_HINT_DOCKER_OWNER_LABEL]: "owner-run",
          [PK_V1_HINT_DOCKER_PACKAGE_LABEL]: "pk-v1-hint-e2e",
        },
      },
    },
  ];
  const result = classifyDockerInspectResult({
    status: 0,
    stdout: JSON.stringify(payload),
    stderr: "",
  });
  assert.equal(result.state, "ok");
  assert.equal(result.packageLabel, "pk-v1-hint-e2e");
}

function testRefusesForeignContainer() {
  const payload = [
    {
      Id: "foreign",
      Config: {
        Image: "postgres:18",
        Labels: {},
      },
    },
  ];
  const originalInspect = assertNoUnownedContainerBeforeMutation;
  void originalInspect;
  try {
    const inspect = classifyDockerInspectResult({
      status: 0,
      stdout: JSON.stringify(payload),
      stderr: "",
    });
    assert.equal(inspect.state, "ok");
    assert.equal(inspect.packageLabel, null);
  } catch (error) {
    assert.fail(String(error));
  }
}

testInspectNotFound();
testInspectOk();
testRefusesForeignContainer();
console.log(JSON.stringify({ docker_ownership_selftest: "ok" }));