#!/usr/bin/env node
import { CX01_SHOWCASE_CONTAINER } from "./constants.mjs";
import { removeOwnedContainer } from "./docker_ownership.mjs";

const containerName =
  process.env.AIEOS360_CX01_I01_SHOWCASE_PG_CONTAINER || CX01_SHOWCASE_CONTAINER;

const outcome = removeOwnedContainer(containerName);
console.log(JSON.stringify(outcome));
if (outcome.removed || outcome.missing) {
  process.exit(0);
}
process.exit(1);
