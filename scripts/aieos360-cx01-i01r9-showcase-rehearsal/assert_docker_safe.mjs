#!/usr/bin/env node
import { assertNoUnownedContainerBeforeMutation } from "./docker_ownership.mjs";
import { CX01_SHOWCASE_CONTAINER } from "./constants.mjs";

const containerName =
  process.env.AIEOS360_CX01_I01_SHOWCASE_PG_CONTAINER || CX01_SHOWCASE_CONTAINER;

try {
  assertNoUnownedContainerBeforeMutation(containerName);
  console.log(JSON.stringify({ ok: true, containerName }));
} catch (error) {
  console.error(String(error));
  process.exit(1);
}
