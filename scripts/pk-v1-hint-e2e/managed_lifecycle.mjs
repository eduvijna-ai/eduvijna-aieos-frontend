import { unlinkSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { removeOwnedContainer, ownershipFilePath, defaultContainerNameForRole } from "./docker_ownership.mjs";
import {
  shouldDeleteOwnershipRecord,
  ownedRoleCleanupSucceeded,
  rawArtifactMayBeDeleted,
  ownershipFileNamesForRole,
  combineFullTeardownOk,
  primaryTeardownFailureCode,
} from "./lifecycle_logic.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../..");
const tmpDir = join(repoRoot, "tmp");

const RAW_TMP_PREFIX = "pk-v1-hint-e2e";
const RAW_TMP_EXACT = new Set([
  "pk-v1-hint-e2e-fixture.json",
  "pk-v1-hint-e2e-db.json",
  "pk-v1-hint-e2e-probe-db.json",
  "pk-v1-hint-e2e-docker-ownership.json",
  "pk-v1-hint-e2e-probe-docker-ownership.json",
  "pk-v1-hint-e2e-env.json",
  "pk-v1-hint-e2e-db-sanitized.json",
  "pk-v1-hint-e2e-probe-db-sanitized.json",
]);

export function exportSanitizedEvidence() {
  const proc = spawnSync(
    "python3",
    [join(__dirname, "emit_sanitized_evidence.py")],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: process.env,
    },
  );
  if (proc.status !== 0) {
    return { ok: false, code: "SANITIZED_EXPORT_FAILED" };
  }
  return { ok: true };
}

export function cleanupOwnedRole(role, { removeContainer = true } = {}) {
  const containerName = defaultContainerNameForRole(role);
  let containerOutcome = { removed: false, skipped: true };
  if (removeContainer) {
    containerOutcome = removeOwnedContainer(containerName, role);
    if (!ownedRoleCleanupSucceeded(containerOutcome)) {
      return {
        ok: false,
        role,
        code: containerOutcome.code || "OWNED_CONTAINER_CLEANUP_DENIED",
        containerOutcome,
        ownershipPreserved: true,
      };
    }
  }

  const ownershipPath = ownershipFilePath(role);
  if (existsSync(ownershipPath) && shouldDeleteOwnershipRecord(containerOutcome)) {
    try {
      unlinkSync(ownershipPath);
    } catch {
      return {
        ok: false,
        role,
        code: "OWNERSHIP_FILE_CLEANUP_FAILED",
        containerOutcome,
        ownershipPreserved: true,
      };
    }
  } else if (
    existsSync(ownershipPath) &&
    removeContainer &&
    !shouldDeleteOwnershipRecord(containerOutcome)
  ) {
    return {
      ok: false,
      role,
      code: containerOutcome.code || "OWNED_CONTAINER_CLEANUP_DENIED",
      containerOutcome,
      ownershipPreserved: true,
    };
  }

  return { ok: true, role, containerOutcome };
}

export function cleanupPartialPrimaryStart() {
  return cleanupOwnedRole("primary");
}

export function cleanupPartialProbeStart() {
  return cleanupOwnedRole("probe");
}

export function cleanupRawTmpArtifacts({
  preserveOwnership = false,
  tmpRoot = tmpDir,
} = {}) {
  const preservedNames = new Set();
  if (preserveOwnership) {
    for (const name of ownershipFileNamesForRole("primary")) {
      preservedNames.add(name);
    }
    for (const name of ownershipFileNamesForRole("probe")) {
      preservedNames.add(name);
    }
  }

  const outcomes = [];
  if (!existsSync(tmpRoot)) {
    return { ok: true, removed: [], skipped: true };
  }
  for (const name of readdirSync(tmpRoot)) {
    if (!name.startsWith(RAW_TMP_PREFIX)) {
      continue;
    }
    if (name.startsWith(`${RAW_TMP_PREFIX}-sanitized`)) {
      continue;
    }
    if (preservedNames.has(name)) {
      continue;
    }
    if (!RAW_TMP_EXACT.has(name) && !name.endsWith("-sanitized.json")) {
      continue;
    }
    if (name.endsWith("-sanitized.json")) {
      if (!RAW_TMP_EXACT.has(name)) {
        continue;
      }
    }
    const path = join(tmpRoot, name);
    try {
      unlinkSync(path);
      outcomes.push(name);
    } catch {
      return { ok: false, code: "RAW_TMP_CLEANUP_FAILED", path: name };
    }
  }
  return { ok: true, removed: outcomes };
}

export function cleanupFullPkV1HintE2e({
  ciExternal = false,
  skipSanitizedExport = false,
  skipContainerTeardown = false,
  exportFn = exportSanitizedEvidence,
  cleanupRoleFn = cleanupOwnedRole,
  rawCleanupFn = cleanupRawTmpArtifacts,
} = {}) {
  let sanitized = { ok: true, skipped: true };
  if (!skipSanitizedExport) {
    sanitized = exportFn();
  }

  const containerResults = [];
  const skippedContainers = ciExternal || skipContainerTeardown;
  if (!skippedContainers) {
    containerResults.push(cleanupRoleFn("primary"));
    containerResults.push(cleanupRoleFn("probe"));
  } else if (ciExternal) {
    containerResults.push({
      ok: true,
      role: "primary",
      containerOutcome: { removed: false, skipped: true, reason: "CI_EXTERNAL_PG" },
    });
    containerResults.push({
      ok: true,
      role: "probe",
      containerOutcome: { removed: false, skipped: true, reason: "CI_EXTERNAL_PG" },
    });
  } else {
    containerResults.push({
      ok: true,
      role: "primary",
      containerOutcome: {
        removed: false,
        skipped: true,
        reason: "UNCERTAIN_CHILD_PROCESSES",
      },
    });
    containerResults.push({
      ok: true,
      role: "probe",
      containerOutcome: {
        removed: false,
        skipped: true,
        reason: "UNCERTAIN_CHILD_PROCESSES",
      },
    });
  }

  const preserveOwnership =
    skipContainerTeardown ||
    !rawArtifactMayBeDeleted({ containerResults, ciExternal });
  const raw = rawCleanupFn({ preserveOwnership });

  const ok = combineFullTeardownOk({
    sanitized,
    containerResults,
    raw,
  });
  const code = ok ? null : primaryTeardownFailureCode({ sanitized, containerResults, raw });
  return {
    ok,
    code,
    sanitized,
    containerResults,
    raw,
    skipContainerTeardown,
    ownershipPreserved: preserveOwnership,
  };
}