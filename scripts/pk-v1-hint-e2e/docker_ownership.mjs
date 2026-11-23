import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PK_V1_HINT_E2E_CONTAINER } from "./constants.mjs";
import {
  PK_V1_HINT_DOCKER_OWNER_LABEL,
  PK_V1_HINT_DOCKER_PACKAGE_LABEL,
  classifyDockerInspectResult,
} from "./docker_inspect.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../..");
const ownershipPath = join(repoRoot, "tmp", "pk-v1-hint-e2e-docker-ownership.json");

export const EXPECTED_POSTGRES_IMAGE = "postgres:18";

export function ownershipFilePath() {
  return ownershipPath;
}

function dockerInspect(containerName) {
  const result = spawnSync("docker", ["inspect", containerName], {
    encoding: "utf8",
  });
  return classifyDockerInspectResult(result);
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

export function removeContainerById(containerId) {
  if (!containerId || typeof containerId !== "string") {
    return { removed: false, error: "missing container id" };
  }
  const docker = spawnSync("docker", ["rm", "-f", containerId], {
    encoding: "utf8",
  });
  if (docker.status !== 0) {
    return {
      removed: false,
      error: docker.stderr || docker.stdout || "docker rm failed",
    };
  }
  return { removed: true, containerId };
}

export function assertNoUnownedContainerBeforeMutation(
  containerName = PK_V1_HINT_E2E_CONTAINER,
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
    inspect.packageLabel === "pk-v1-hint-e2e"
  ) {
    return;
  }
  throw new Error(
    `REFUSE: container ${containerName} exists but is not PK-V1-HINT-owned (id=${inspect.containerId})`,
  );
}

export function verifyContainerForDestruction(
  containerName = PK_V1_HINT_E2E_CONTAINER,
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
  return { ok: true, inspect, record };
}

export function startGovernedPostgresContainer({
  containerName = PK_V1_HINT_E2E_CONTAINER,
  hostPort,
  bootstrapUser = "aieos_bootstrap",
  dbPassword = "aieos_test",
  dbName = "aieos",
}) {
  assertNoUnownedContainerBeforeMutation(containerName);
  const ownerRunId = randomUUID();
  const existing = dockerInspect(containerName);
  if (existing.state === "ok") {
    throw new Error(
      `REFUSE: named container ${containerName} already exists; will not delete foreign instance`,
    );
  }
  if (existing.state === "error") {
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
      `${PK_V1_HINT_DOCKER_OWNER_LABEL}=${ownerRunId}`,
      "--label",
      `${PK_V1_HINT_DOCKER_PACKAGE_LABEL}=pk-v1-hint-e2e`,
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
  const createdContainerId = (run.stdout || "").trim();
  if (!createdContainerId) {
    throw new Error("docker run succeeded but returned no container id");
  }
  const inspect = dockerInspect(containerName);
  if (inspect.state !== "ok") {
    removeContainerById(createdContainerId);
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

export function removeOwnedContainer(containerName = PK_V1_HINT_E2E_CONTAINER) {
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