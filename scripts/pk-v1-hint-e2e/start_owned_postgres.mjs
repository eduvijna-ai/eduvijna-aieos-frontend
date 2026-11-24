#!/usr/bin/env node
import { DEFAULT_PG_PORT, PK_V1_HINT_E2E_CONTAINER } from "./constants.mjs";
import { startGovernedPostgresContainer } from "./docker_ownership.mjs";

const hostPort = Number(process.env.AIEOS_TEST_PG_PORT || DEFAULT_PG_PORT);
const containerName =
  process.env.PK_V1_HINT_E2E_PG_CONTAINER || PK_V1_HINT_E2E_CONTAINER;

try {
  const record = startGovernedPostgresContainer({
    containerName,
    hostPort,
  });
  console.log(
    JSON.stringify({
      ok: true,
      container_name: record.containerName,
      container_id_prefix: record.containerId.slice(0, 12),
      host_port: record.hostPort,
      postgres_image: "postgres:18",
    }),
  );
} catch (error) {
  console.error(String(error));
  process.exit(1);
}