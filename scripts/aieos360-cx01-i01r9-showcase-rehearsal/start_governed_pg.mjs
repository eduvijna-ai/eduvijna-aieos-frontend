#!/usr/bin/env node
import { CX01_SHOWCASE_CONTAINER } from "./constants.mjs";
import { startGovernedPostgresContainer } from "./docker_ownership.mjs";

const hostPort = process.env.AIEOS_TEST_PG_PORT || "55448";
const containerName =
  process.env.AIEOS360_CX01_I01_SHOWCASE_PG_CONTAINER || CX01_SHOWCASE_CONTAINER;

const record = startGovernedPostgresContainer({
  containerName,
  hostPort: Number(hostPort),
});
console.log(JSON.stringify({ ok: true, ...record }));
