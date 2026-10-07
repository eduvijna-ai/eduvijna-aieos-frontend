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
import { writeOperatorStatus } from "./process_group.mjs";

failClosedNonLinuxExit("showcase:aieos360:stop");
runPinGuard();

let governedPorts = [];
if (existsSync(statusPath)) {
  const status = JSON.parse(readFileSync(statusPath, "utf8"));
  governedPorts = status.governed_ports ?? [];
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

if (governedPorts.length > 0) {
  try {
    await assertPortsReleased(governedPorts);
  } catch (error) {
    writeOperatorStatus({
      phase: "stop_failed",
      classification: "NON_PRODUCTION",
      port_release_error: String(error),
      governed_ports: governedPorts,
      stopped_at: new Date().toISOString(),
    });
    console.error(JSON.stringify({ phase: "stop_failed", error: String(error) }, null, 2));
    process.exit(1);
  }
}

writeOperatorStatus({
  phase: "stopped",
  classification: "NON_PRODUCTION",
  ports_released: governedPorts.length > 0,
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
      governed_ports_released: governedPorts.length > 0,
      owned_local_container_removed: Boolean(cleanup.containerOutcome?.removed),
      stop_timing: cleanup.stopTiming,
    },
    null,
    2,
  ),
);
