#!/usr/bin/env node
import { createServer } from "node:net";
import { readFileSync, existsSync } from "node:fs";
import { failClosedNonLinuxExit } from "./linux_platform.mjs";
import { runPinGuard } from "./pin_guard.mjs";
import { statusPath } from "./paths.mjs";
import {
  stopRegisteredProcessGroups,
  writeOperatorStatus,
} from "./process_group.mjs";

failClosedNonLinuxExit("showcase:aieos360:stop");
runPinGuard();

async function assertPortsReleased(ports) {
  for (const port of ports) {
    await new Promise((resolve, reject) => {
      const server = createServer();
      server.once("error", reject);
      server.listen(port, "127.0.0.1", () => {
        server.close(() => resolve(undefined));
      });
    });
  }
}

let governedPorts = [];
if (existsSync(statusPath)) {
  const status = JSON.parse(readFileSync(statusPath, "utf8"));
  governedPorts = status.governed_ports ?? [];
}

const outcome = await stopRegisteredProcessGroups();

if (outcome.rejected.length > 0) {
  writeOperatorStatus({
    phase: "stop_failed",
    classification: "NON_PRODUCTION",
    rejected: outcome.rejected,
    stopped_at: new Date().toISOString(),
  });
  console.error(JSON.stringify({ phase: "stop_failed", rejected: outcome.rejected }, null, 2));
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
  stopped_at: new Date().toISOString(),
});

console.log(
  JSON.stringify(
    {
      stopped: true,
      classification: "NON_PRODUCTION",
      phase: "stopped",
      governed_ports_released: governedPorts.length > 0,
    },
    null,
    2,
  ),
);
