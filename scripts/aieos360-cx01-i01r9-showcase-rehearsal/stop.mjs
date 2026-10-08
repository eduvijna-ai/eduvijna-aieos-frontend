#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { failClosedNonLinuxExit } from "./linux_platform.mjs";
import { runPinGuard } from "./pin_guard.mjs";
import { statusPath } from "./paths.mjs";
import {
  cleanupManagedStack,
  localOwnedContainerExpected,
  assertPortsReleased,
} from "./managed_cleanup.mjs";
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

let registryPortEvidence = [];
try {
  const registry = readProcessRegistry();
  registryPortEvidence = portsFromRegistryChildren(registry.children);
} catch {
  /* registry read remains fail-closed elsewhere; stop teardown uses cleanup path */
}

const removeContainer = localOwnedContainerExpected();
const cleanup = await cleanupManagedStack({
  removeOwnedLocalContainer: removeContainer,
  assertGovernedPgPortReleased: removeContainer,
});

if (!cleanup.ok || cleanup.rejected?.length > 0) {
  writeOperatorStatus({
    phase: "stop_failed",
    classification: "NON_PRODUCTION",
    rejected: cleanup.rejected,
    container_outcome: cleanup.containerOutcome,
    stop_timing: cleanup.stopTiming,
    error: cleanup.error,
    status_metadata_error: statusMetadataError,
    stopped_at: new Date().toISOString(),
  });
  console.error(
    JSON.stringify(
      {
        phase: "stop_failed",
        rejected: cleanup.rejected,
        container: cleanup.containerOutcome,
        error: cleanup.error,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

const portsToVerify =
  governedPortsFromStatus.length > 0
    ? governedPortsFromStatus
    : registryPortEvidence;
let portsReleased = false;
let portReleaseError = null;

if (portsToVerify.length > 0) {
  try {
    await assertPortsReleased(portsToVerify);
    portsReleased = true;
  } catch (error) {
    portReleaseError = String(error);
    writeOperatorStatus({
      phase: "stop_failed",
      classification: "NON_PRODUCTION",
      port_release_error: portReleaseError,
      governed_ports_checked: portsToVerify,
      status_metadata_error: statusMetadataError,
      stopped_at: new Date().toISOString(),
    });
    console.error(JSON.stringify({ phase: "stop_failed", error: portReleaseError }, null, 2));
    process.exit(1);
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
  owned_local_container_removed: Boolean(cleanup.containerOutcome?.removed),
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
      owned_local_container_removed: Boolean(cleanup.containerOutcome?.removed),
      stop_timing: cleanup.stopTiming,
      status_metadata_recovered: Boolean(statusMetadataError),
    },
    null,
    2,
  ),
);
