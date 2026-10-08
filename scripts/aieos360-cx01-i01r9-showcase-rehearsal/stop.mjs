#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { failClosedNonLinuxExit } from "./linux_platform.mjs";
import { runPinGuard } from "./pin_guard.mjs";
import { dbReportPath, statusPath } from "./paths.mjs";
import { DEDICATED_PG_HOST_PORT } from "./constants.mjs";
import {
  cleanupManagedStack,
  usesExternalCiPostgres,
  assertPortsReleased,
} from "./managed_cleanup.mjs";
import { removeOwnedContainer } from "./docker_ownership.mjs";
import { readProcessRegistry, writeOperatorStatus } from "./process_group.mjs";

failClosedNonLinuxExit("showcase:aieos360:stop");
runPinGuard();

function safeTcpPorts(values) {
  const ports = [];
  for (const port of values) {
    if (Number.isSafeInteger(port) && port > 0 && port <= 65535) {
      ports.push(port);
    }
  }
  return [...new Set(ports)];
}

function portsFromRegistryChildren(children) {
  return safeTcpPorts((children ?? []).map((entry) => entry?.port));
}

function writeStopFailed(payload) {
  writeOperatorStatus({
    classification: "NON_PRODUCTION",
    stopped_at: new Date().toISOString(),
    ...payload,
  });
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
}

let governedPortsFromStatus = [];
let statusMetadataError = null;
if (existsSync(statusPath)) {
  try {
    const status = JSON.parse(readFileSync(statusPath, "utf8"));
    governedPortsFromStatus = safeTcpPorts(status.governed_ports ?? []);
  } catch (error) {
    statusMetadataError = String(error);
  }
}

let dbReportMetadataError = null;
let dbReportStartedContainerEvidence = null;
if (existsSync(dbReportPath)) {
  try {
    const dbReport = JSON.parse(readFileSync(dbReportPath, "utf8"));
    dbReportStartedContainerEvidence = dbReport.started_container === true;
  } catch (error) {
    dbReportMetadataError = String(error);
  }
}

let registryPortEvidence = [];
try {
  const registry = readProcessRegistry();
  registryPortEvidence = portsFromRegistryChildren(registry.children);
} catch {
  /* registry read remains fail-closed elsewhere; stop teardown uses cleanup path */
}

const externalCiPostgres = usesExternalCiPostgres();

const cleanup = await cleanupManagedStack({
  removeOwnedLocalContainer: false,
  assertGovernedPgPortReleased: false,
});

let containerOutcome = cleanup.containerOutcome ?? null;

if (!cleanup.ok || cleanup.rejected?.length > 0) {
  writeStopFailed({
    phase: "stop_failed",
    rejected: cleanup.rejected,
    container_outcome: containerOutcome,
    stop_timing: cleanup.stopTiming,
    error: cleanup.error,
    status_metadata_error: statusMetadataError,
    db_report_metadata_error: dbReportMetadataError,
    process_stop_ok: false,
  });
}

if (!externalCiPostgres) {
  containerOutcome = removeOwnedContainer();
  if (containerOutcome.inspection_error) {
    writeStopFailed({
      phase: "stop_failed",
      container_outcome: containerOutcome,
      stop_timing: cleanup.stopTiming,
      error: containerOutcome.error,
      status_metadata_error: statusMetadataError,
      db_report_metadata_error: dbReportMetadataError,
      process_stop_ok: true,
    });
  }
  if (!containerOutcome.removed && !containerOutcome.missing) {
    writeStopFailed({
      phase: "stop_failed",
      container_outcome: containerOutcome,
      stop_timing: cleanup.stopTiming,
      error: containerOutcome.error || "owned container not removed",
      status_metadata_error: statusMetadataError,
      db_report_metadata_error: dbReportMetadataError,
      process_stop_ok: true,
    });
  }
  if (containerOutcome.removed) {
    try {
      await assertPortsReleased([DEDICATED_PG_HOST_PORT]);
    } catch (error) {
      writeStopFailed({
        phase: "stop_failed",
        port_release_error: String(error),
        governed_pg_port_checked: DEDICATED_PG_HOST_PORT,
        container_outcome: containerOutcome,
        stop_timing: cleanup.stopTiming,
        status_metadata_error: statusMetadataError,
        db_report_metadata_error: dbReportMetadataError,
        process_stop_ok: true,
      });
    }
  }
}

const portsToVerify =
  governedPortsFromStatus.length > 0
    ? governedPortsFromStatus
    : registryPortEvidence;
let portsReleased = false;

if (portsToVerify.length > 0) {
  try {
    await assertPortsReleased(portsToVerify);
    portsReleased = true;
  } catch (error) {
    writeStopFailed({
      phase: "stop_failed",
      port_release_error: String(error),
      governed_ports_checked: portsToVerify,
      status_metadata_error: statusMetadataError,
      db_report_metadata_error: dbReportMetadataError,
      container_outcome: containerOutcome,
      stop_timing: cleanup.stopTiming,
      process_stop_ok: true,
    });
  }
}

writeOperatorStatus({
  phase: "stopped",
  classification: "NON_PRODUCTION",
  ports_released: portsReleased,
  governed_ports_checked: portsToVerify,
  governed_ports_source:
    governedPortsFromStatus.length > 0 ? "operator_status" : "process_registry",
  status_metadata_error: statusMetadataError,
  status_metadata_recovered: Boolean(statusMetadataError),
  db_report_metadata_error: dbReportMetadataError,
  db_report_metadata_recovered: Boolean(dbReportMetadataError),
  db_report_started_container_evidence: dbReportStartedContainerEvidence,
  owned_local_container_removed: Boolean(containerOutcome?.removed),
  container_outcome: containerOutcome,
  process_stop_ok: true,
  external_ci_postgres: externalCiPostgres,
  stop_timing: cleanup.stopTiming,
  stopped_at: new Date().toISOString(),
});

console.log(
  JSON.stringify(
    {
      stopped: true,
      classification: "NON_PRODUCTION",
      phase: "stopped",
      governed_ports_released: portsReleased,
      governed_ports_checked: portsToVerify,
      owned_local_container_removed: Boolean(containerOutcome?.removed),
      stop_timing: cleanup.stopTiming,
      status_metadata_recovered: Boolean(statusMetadataError),
      db_report_metadata_recovered: Boolean(dbReportMetadataError),
      process_stop_ok: true,
    },
    null,
    2,
  ),
);
