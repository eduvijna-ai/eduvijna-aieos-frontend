import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import {
  CX01_SHOWCASE_CONTAINER,
} from "./constants.mjs";
import { repoRoot } from "./paths.mjs";

export const CX01_DOCKER_OWNER_LABEL = "aieos360.cx01.owner";
export const CX01_DOCKER_PACKAGE_LABEL = "aieos360.cx01.package";
export const EXPECTED_POSTGRES_IMAGE = "postgres:18";

const ownershipPath = join(
  repoRoot,
  "tmp",
  "aieos360-cx01-i01-showcase-docker-ownership.json",
);

export function ownershipFilePath() {
  return ownershipPath;
}

function dockerInspect(containerName) {
  const result = spawnSync("docker", ["inspect", containerName], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    return { exists: false, error: result.stderr || result.stdout };
  }
  let parsed;
  try {
    parsed = JSON.parse(result.stdout)[0];
  } catch {
    return { exists: false, error: "docker inspect returned invalid JSON" };
  }
  const labels = parsed?.Config?.Labels ?? {};
  return {
    exists: true,
    containerId: parsed.Id,
    image: parsed.Config?.Image,
    ownerLabel: labels[CX01_DOCKER_OWNER_LABEL] ?? null,
    packageLabel: labels[CX01_DOCKER_PACKAGE_LABEL] ?? null,
  };
}

export function readOwnershipRecord() {
  if (!existsSync(ownershipPath)) {
    return null;
  }
  return JSON.parse(readFileSync(ownershipPath, "utf8"));
}

export function writeOwnershipRecord(record) {
  writeFileSync(ownershipPath, JSON.stringify(record, null, 2) + "\n", "utf8");
}

export function assertNoUnownedContainerBeforeMutation(containerName = CX01_SHOWCASE_CONTAINER) {
  const inspect = dockerInspect(containerName);
  if (!inspect.exists) {
    return;
  }
  const record = readOwnershipRecord();
  if (record?.containerId === inspect.containerId && record?.ownerRunId) {
    return;
  }
  if (inspect.ownerLabel && inspect.packageLabel === "cx01-i01-showcase-rehearsal") {
    return;
  }
  throw new Error(
    `REFUSE: container ${containerName} exists but is not CX01-owned (id=${inspect.containerId})`,
  );
}

export function verifyContainerForDestruction(
  containerName = CX01_SHOWCASE_CONTAINER,
) {
  const inspect = dockerInspect(containerName);
  if (!inspect.exists) {
    return { ok: false, missing: true };
  }
  const record = readOwnershipRecord();
  if (!record?.containerId) {
    return { ok: false, error: "no ownership record for container" };
  }
  if (record.containerId !== inspect.containerId) {
    return { ok: false, error: "container id does not match ownership record" };
  }
  if (!inspect.image?.includes(EXPECTED_POSTGRES_IMAGE)) {
    return { ok: false, error: `unexpected image ${inspect.image}` };
  }
  if (
    inspect.ownerLabel &&
    record.ownerRunId &&
    inspect.ownerLabel !== record.ownerRunId
  ) {
    return { ok: false, error: "docker owner label mismatch" };
  }
  return { ok: true, inspect, record };
}

export function startGovernedPostgresContainer({
  containerName = CX01_SHOWCASE_CONTAINER,
  hostPort,
  bootstrapUser = "aieos_bootstrap",
  dbPassword = "aieos_test",
  dbName = "aieos",
}) {
  assertNoUnownedContainerBeforeMutation(containerName);
  const ownerRunId = randomUUID();
  spawnSync("docker", ["rm", "-f", containerName], { encoding: "utf8" });
  const run = spawnSync(
    "docker",
    [
      "run",
      "-d",
      "--rm",
      "--name",
      containerName,
      "--label",
      `${CX01_DOCKER_OWNER_LABEL}=${ownerRunId}`,
      "--label",
      `${CX01_DOCKER_PACKAGE_LABEL}=cx01-i01-showcase-rehearsal`,
      "-e",
      `POSTGRES_USER=${bootstrapUser}`,
      "-e",
      `POSTGRES_PASSWORD=${dbPassword}`,
      "-e",
      `POSTGRES_DB=${dbName}`,
      "-p",
      `${hostPort}:5432`,
      EXPECTED_POSTGRES_IMAGE,
    ],
    { encoding: "utf8" },
  );
  if (run.status !== 0) {
    throw new Error(run.stderr || run.stdout || "docker run failed");
  }
  const inspect = dockerInspect(containerName);
  if (!inspect.exists) {
    throw new Error("governed postgres container did not start");
  }
  const record = {
    ownerRunId,
    containerId: inspect.containerId,
    containerName,
    image: inspect.image,
    hostPort: String(hostPort),
    recordedAt: new Date().toISOString(),
  };
  writeOwnershipRecord(record);
  return record;
}

export function removeOwnedContainer(containerName = CX01_SHOWCASE_CONTAINER) {
  const verified = verifyContainerForDestruction(containerName);
  if (verified.missing) {
    return { removed: false, missing: true };
  }
  if (!verified.ok) {
    return { removed: false, error: verified.error };
  }
  const docker = spawnSync("docker", ["rm", "-f", containerName], { encoding: "utf8" });
  if (docker.status !== 0) {
    return { removed: false, error: docker.stderr || docker.stdout };
  }
  return { removed: true, containerId: verified.record.containerId };
}
