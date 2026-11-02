/**
 * Parse and validate I01R9 managed showcase status JSON (live health required).
 */
import { EXPECTED_MANAGED_PROCESS_COUNT } from "./rehearse_report.mjs";
import {
  CANONICAL_HTTP_ROLES,
  EXPECTED_MANAGED_PROCESS_ROLES,
  portFromHttpUrl,
  REGISTRY_ROLE_TO_HTTP_ROLE,
} from "./managed_registry_roles.mjs";

const EXPECTED_HTTP_HEALTH_CHECKS = CANONICAL_HTTP_ROLES.length * 2;

export { CANONICAL_HTTP_ROLES };

export function parseStatusStdout(stdout) {
  const text = String(stdout || "").trim();
  const jsonStart = text.indexOf("{");
  if (jsonStart < 0) {
    throw new Error("CX01-I07 status: no JSON object in stdout");
  }
  return JSON.parse(text.slice(jsonStart));
}

function assertCanonicalHealthChecks(checks) {
  if (checks.length !== EXPECTED_HTTP_HEALTH_CHECKS) {
    throw new Error(
      `CX01-I07 status: expected ${EXPECTED_HTTP_HEALTH_CHECKS} HTTP health checks, got ${checks.length}`,
    );
  }
  for (const role of CANONICAL_HTTP_ROLES) {
    const roleChecks = checks.filter((entry) => entry.role === role);
    if (roleChecks.length !== 2) {
      throw new Error(
        `CX01-I07 status: role ${role} must have exactly 2 checks, got ${roleChecks.length}`,
      );
    }
    const surfaces = roleChecks.map((entry) => entry.surface).sort();
    if (surfaces.join(",") !== "backend,frontend") {
      throw new Error(
        `CX01-I07 status: role ${role} must have backend+frontend checks, got ${surfaces.join(",")}`,
      );
    }
    for (const entry of roleChecks) {
      if (entry.ok !== true) {
        throw new Error(
          `CX01-I07 status: role ${role} surface ${entry.surface} not ok`,
        );
      }
    }
  }
  const seen = new Set(checks.map((entry) => `${entry.role}:${entry.surface}`));
  if (seen.size !== EXPECTED_HTTP_HEALTH_CHECKS) {
    throw new Error("CX01-I07 status: duplicate health check role/surface");
  }
}

function assertLiveProcessesAndPorts(report) {
  const roleUrls = report.operator_status?.role_urls;
  if (!roleUrls) {
    throw new Error("CX01-I07 status: operator_status.role_urls missing");
  }
  const processes = report.live_processes ?? [];
  if (processes.length !== EXPECTED_MANAGED_PROCESS_COUNT) {
    throw new Error(
      `CX01-I07 status: expected ${EXPECTED_MANAGED_PROCESS_COUNT} live_processes entries, got ${processes.length}`,
    );
  }
  const byRegistryRole = new Map(processes.map((entry) => [entry.role, entry]));
  for (const registryRole of EXPECTED_MANAGED_PROCESS_ROLES) {
    const entry = byRegistryRole.get(registryRole);
    if (!entry) {
      throw new Error(`CX01-I07 status: missing live process ${registryRole}`);
    }
    if (!entry.pid || Number(entry.pid) <= 0) {
      throw new Error(`CX01-I07 status: invalid pid for ${registryRole}`);
    }
    const httpRole = REGISTRY_ROLE_TO_HTTP_ROLE[registryRole];
    const urls = roleUrls[httpRole];
    if (!urls) {
      throw new Error(`CX01-I07 status: missing role_urls for ${httpRole}`);
    }
    const expectedPort = registryRole.endsWith("_frontend")
      ? portFromHttpUrl(urls.frontend)
      : portFromHttpUrl(urls.backend);
    if (Number(entry.port) !== expectedPort) {
      throw new Error(
        `CX01-I07 status: port mismatch for ${registryRole} (expected ${expectedPort}, got ${entry.port})`,
      );
    }
  }
}

export function assertManagedStatusReport(report) {
  if (report.operator_status?.phase !== "running") {
    throw new Error(
      `CX01-I07 status: expected phase running, got ${report.operator_status?.phase}`,
    );
  }
  if (report.live_process_count !== EXPECTED_MANAGED_PROCESS_COUNT) {
    throw new Error(
      `CX01-I07 status: expected ${EXPECTED_MANAGED_PROCESS_COUNT} live managed processes, got ${report.live_process_count}`,
    );
  }
  if ((report.missing_live_roles ?? []).length > 0) {
    throw new Error(
      `CX01-I07 status: missing roles ${report.missing_live_roles.join(", ")}`,
    );
  }
  if (report.registry_truth !== "live_registry_matches_expected") {
    throw new Error(
      `CX01-I07 status: registry_truth ${report.registry_truth}`,
    );
  }
  if (report.readiness_ok !== true) {
    throw new Error("CX01-I07 status: readiness_ok is not true");
  }
  assertCanonicalHealthChecks(report.health_checks ?? []);
  assertLiveProcessesAndPorts(report);
  return report;
}
