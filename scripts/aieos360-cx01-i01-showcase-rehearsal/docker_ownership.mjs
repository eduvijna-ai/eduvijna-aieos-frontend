import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { CX01_SHOWCASE_CONTAINER } from "./constants.mjs";
import { repoRoot } from "./paths.mjs";
import {
  CX01_DOCKER_OWNER_LABEL,
  CX01_DOCKER_PACKAGE_LABEL,
  classifyDockerInspectResult,
} from "./docker_inspect.mjs";

export { CX01_DOCKER_OWNER_LABEL, CX01_DOCKER_PACKAGE_LABEL };
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
  const classified = classifyDockerInspectResult(result);
  if (classified.state === "error") {
    return classified;
  }
  if (classified.state === "not_found") {
    return classified;
  }
  return classified;
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

export function assertNoUnownedContainerBeforeMutation(
  containerName = CX01_SHOWCASE_CONTAINER,
) {
  const inspect = dockerInspect(containerName);
  if (inspect.state === "error") {
    throw new Error(`DOCKER INSPECTION BLOCKED — ${inspect.error}`);
  }
  if (inspect.state === "not_found") {
    return;
  }
  const record = readOwnershipRecord();
  if (record?.containerId === inspect.containerId && record?.ownerRunId) {
    return;
  }
  if (
    inspect.ownerLabel &&
    inspect.packageLabel === "cx01-i01-showcase-rehearsal"
  ) {
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
  if (inspect.state === "error") {
    return { ok: false, inspection_error: true, error: inspect.error };
  }
  if (inspect.state === "not_found") {
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
  const existing = dockerInspect(containerName);
  if (existing.state === "ok") {
    const verified = verifyContainerForDestruction(containerName);
    if (verified.ok) {
      spawnSync("docker", ["rm", "-f", verified.record.containerId], {
        encoding: "utf8",
      });
    } else {
      throw new Error(
        verified.error || "cannot remove existing container without verified ownership",
      );
    }
  } else if (existing.state === "error") {
    throw new Error(`DOCKER INSPECTION BLOCKED — ${existing.error}`);
  }
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
  if (inspect.state === "error") {
    throw new Error(`DOCKER INSPECTION BLOCKED — ${inspect.error}`);
  }
  if (inspect.state !== "ok") {
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
  if (verified.inspection_error) {
    return { removed: false, inspection_error: true, error: verified.error };
  }
  if (verified.missing) {
    return { removed: false, missing: true };
  }
  if (!verified.ok) {
    return { removed: false, error: verified.error };
  }
  const docker = spawnSync(
    "docker",
    ["rm", "-f", verified.record.containerId],
    { encoding: "utf8" },
  );
  if (docker.status !== 0) {
    return { removed: false, error: docker.stderr || docker.stdout };
  }
  return { removed: true, containerId: verified.record.containerId };
}
