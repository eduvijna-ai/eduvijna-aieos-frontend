/**
 * Parse and validate I01R9 managed showcase status JSON (live health required).
 */
const EXPECTED_MANAGED_ROLE_COUNT = 8;

export function parseStatusStdout(stdout) {
  const text = String(stdout || "").trim();
  const jsonStart = text.indexOf("{");
  if (jsonStart < 0) {
    throw new Error("CX01-I07 status: no JSON object in stdout");
  }
  return JSON.parse(text.slice(jsonStart));
}

export function assertManagedStatusReport(report) {
  if (report.operator_status?.phase !== "running") {
    throw new Error(
      `CX01-I07 status: expected phase running, got ${report.operator_status?.phase}`,
    );
  }
  if (report.live_process_count !== EXPECTED_MANAGED_ROLE_COUNT) {
    throw new Error(
      `CX01-I07 status: expected ${EXPECTED_MANAGED_ROLE_COUNT} live roles, got ${report.live_process_count}`,
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
  const checks = report.health_checks ?? [];
  const failed = checks.filter((entry) => entry.ok === false);
  if (failed.length > 0) {
    throw new Error(
      `CX01-I07 status: failed health checks ${JSON.stringify(failed)}`,
    );
  }
  const minChecks = EXPECTED_MANAGED_ROLE_COUNT * 2;
  if (checks.length < minChecks) {
    throw new Error(
      `CX01-I07 status: expected at least ${minChecks} health checks, got ${checks.length}`,
    );
  }
  return report;
}
