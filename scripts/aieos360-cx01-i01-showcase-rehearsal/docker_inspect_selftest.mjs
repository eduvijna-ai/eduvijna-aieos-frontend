#!/usr/bin/env node
import { classifyDockerInspectResult } from "./docker_inspect.mjs";

const cases = [
  {
    name: "daemon_permission_error",
    input: {
      status: 1,
      stdout: "",
      stderr: "permission denied while trying to connect",
    },
    expect: "error",
  },
  {
    name: "missing_docker_context_not_found",
    input: {
      status: 1,
      stdout: "",
      stderr: 'context "missing-context": not found',
    },
    expect: "error",
  },
  {
    name: "missing_container_exact",
    input: {
      status: 1,
      stdout: "",
      stderr: "Error: No such object: abc",
    },
    expect: "not_found",
  },
  {
    name: "invalid_json",
    input: { status: 0, stdout: "not-json", stderr: "" },
    expect: "error",
  },
  {
    name: "successful_empty_array",
    input: { status: 0, stdout: "[]", stderr: "" },
    expect: "error",
  },
  {
    name: "successful_empty_object",
    input: { status: 0, stdout: "{}", stderr: "" },
    expect: "error",
  },
];

for (const item of cases) {
  const result = classifyDockerInspectResult(item.input);
  if (result.state !== item.expect) {
    console.error(
      `expected ${item.expect} for ${item.name}, got ${result.state}`,
    );
    process.exit(1);
  }
}

console.log(JSON.stringify({ ok: true, cases: cases.map((c) => c.name) }));
