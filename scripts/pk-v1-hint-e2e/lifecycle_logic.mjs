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

/**
 * Fail-closed: export failure still requires container/raw stages to have run;
 * any stage failure yields teardown not-ok.
 */
export function combineFullTeardownOk({
  sanitized,
  containerResults,
  raw,
  skipContainerTeardown = false,
  ciExternal = false,
}) {
  if (skipContainerTeardown && !ciExternal) {
    return false;
  }
  const containerDenied = (containerResults || []).some((r) => r.ok === false);
  if (containerDenied) {
    return false;
  }
  if (raw && raw.ok === false) {
    return false;
  }
  if (sanitized && sanitized.skipped !== true && sanitized.ok === false) {
    return false;
  }
  return true;
}

export function primaryTeardownFailureCode({
  sanitized,
  containerResults,
  raw,
  skipContainerTeardown = false,
  ciExternal = false,
}) {
  if (skipContainerTeardown && !ciExternal) {
    return "LIFECYCLE_UNCERTAIN";
  }
  if (sanitized && sanitized.skipped !== true && sanitized.ok === false) {
    return sanitized.code || "EXPORT_FAILED";
  }
  const containerDenied = (containerResults || []).find((r) => r.ok === false);
  if (containerDenied) {
    return containerDenied.code || "CLEANUP_FAILED";
  }
  if (raw && raw.ok === false) {
    return raw.code || "RAW_CREDENTIAL_ERASE_FAILED";
  }
  return null;
}