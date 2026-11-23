import { unlinkSync, existsSync } from "node:fs";
import { removeOwnedContainer, ownershipFilePath, defaultContainerNameForRole } from "./docker_ownership.mjs";

export function cleanupOwnedRole(role, { removeContainer = true } = {}) {
  const containerName = defaultContainerNameForRole(role);
  let containerOutcome = { removed: false, skipped: true };
  if (removeContainer) {
    containerOutcome = removeOwnedContainer(containerName, role);
    if (
      !containerOutcome.removed &&
      !containerOutcome.missing &&
      !containerOutcome.inspection_error
    ) {
      return {
        ok: false,
        role,
        code: containerOutcome.code || "OWNED_CONTAINER_CLEANUP_DENIED",
        containerOutcome,
      };
    }
  }
  const ownershipPath = ownershipFilePath(role);
  if (existsSync(ownershipPath)) {
    try {
      unlinkSync(ownershipPath);
    } catch {
      return { ok: false, role, code: "OWNERSHIP_FILE_CLEANUP_FAILED", containerOutcome };
    }
  }
  return { ok: true, role, containerOutcome };
}

export function cleanupPartialPrimaryStart() {
  return cleanupOwnedRole("primary");
}

export function cleanupPartialProbeStart() {
  return cleanupOwnedRole("probe");
}