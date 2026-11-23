import { unlinkSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { removeOwnedContainer, ownershipFilePath, defaultContainerNameForRole } from "./docker_ownership.mjs";

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

export function cleanupRawTmpArtifacts() {
  const outcomes = [];
  if (!existsSync(tmpDir)) {
    return { ok: true, removed: [], skipped: true };
  }
  for (const name of readdirSync(tmpDir)) {
    if (!name.startsWith(RAW_TMP_PREFIX)) {
      continue;
    }
    if (name.startsWith(`${RAW_TMP_PREFIX}-sanitized`)) {
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
    const path = join(tmpDir, name);
    try {
      unlinkSync(path);
      outcomes.push(name);
    } catch {
      return { ok: false, code: "RAW_TMP_CLEANUP_FAILED", path: name };
    }
  }
  return { ok: true, removed: outcomes };
}

export function cleanupFullPkV1HintE2e({ ciExternal = false } = {}) {
  const containerResults = [];
  if (!ciExternal) {
    containerResults.push(cleanupOwnedRole("primary"));
    containerResults.push(cleanupOwnedRole("probe"));
  } else {
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
  }
  const raw = cleanupRawTmpArtifacts();
  const containerDenied = containerResults.find((r) => r.ok === false);
  if (containerDenied) {
    return { ok: false, code: containerDenied.code, containerResults, raw };
  }
  if (!raw.ok) {
    return { ok: false, code: raw.code, containerResults, raw };
  }
  return { ok: true, containerResults, raw };
}