/**
 * Pure lifecycle decisions for pk-v1-hint E2E teardown (no Docker I/O).
 */

export function shouldDeleteOwnershipRecord(containerOutcome) {
  if (!containerOutcome) {
    return false;
  }
  if (containerOutcome.skipped === true) {
    return false;
  }
  if (containerOutcome.removed === true) {
    return true;
  }
  if (containerOutcome.missing === true) {
    return true;
  }
  if (containerOutcome.inspection_error === true) {
    return false;
  }
  return false;
}

export function ownedRoleCleanupSucceeded(containerOutcome) {
  if (!containerOutcome || containerOutcome.skipped === true) {
    return true;
  }
  if (containerOutcome.removed === true || containerOutcome.missing === true) {
    return true;
  }
  return false;
}

export function combineManagedExitCode(childExitCode, teardownOk) {
  if (teardownOk !== true) {
    return 124;
  }
  if (childExitCode === 0 || childExitCode === undefined) {
    return 0;
  }
  return childExitCode ?? 1;
}

export function rawArtifactMayBeDeleted({ containerResults, ciExternal }) {
  if (ciExternal) {
    return true;
  }
  const denied = (containerResults || []).find(
    (r) => r.ok === false && r.ownershipPreserved === true,
  );
  return !denied;
}

export function ownershipFileNamesForRole(role) {
  return role === "probe"
    ? ["pk-v1-hint-e2e-probe-docker-ownership.json"]
    : ["pk-v1-hint-e2e-docker-ownership.json"];
}