#!/usr/bin/env node
import {
  DEFAULT_PROBE_PG_PORT,
  PK_V1_HINT_E2E_PROBE_CONTAINER,
} from "./constants.mjs";
import { startGovernedPostgresContainer } from "./docker_ownership.mjs";

const hostPort = Number(
  process.env.PK_V1_HINT_E2E_PROBE_PG_PORT || DEFAULT_PROBE_PG_PORT,
);
const containerName =
  process.env.PK_V1_HINT_E2E_PROBE_PG_CONTAINER || PK_V1_HINT_E2E_PROBE_CONTAINER;

try {
  const record = startGovernedPostgresContainer({
    containerName,
    hostPort,
    role: "probe",
  });
  console.log(
    JSON.stringify({
      ok: true,
      role: "probe",
      container_name: record.containerName,
      container_id_prefix: record.containerId.slice(0, 12),
      host_port: record.hostPort,
      postgres_image: "postgres:18",
    }),
  );
} catch {
  console.error("probe postgres start failed");
  process.exit(1);
}