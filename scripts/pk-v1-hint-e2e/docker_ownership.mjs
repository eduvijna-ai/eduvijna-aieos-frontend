import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_PG_PORT,
  DEFAULT_PROBE_PG_PORT,
  PK_V1_HINT_E2E_CONTAINER,
  PK_V1_HINT_E2E_PROBE_CONTAINER,
} from "./constants.mjs";
import {
  PK_V1_HINT_DOCKER_OWNER_LABEL,
  PK_V1_HINT_DOCKER_PACKAGE_LABEL,
  classifyDockerInspectResult,
} from "./docker_inspect.mjs";
import {
  EXPECTED_POSTGRES_IMAGE,
  PK_V1_HINT_PACKAGE,
  evaluateDestructionPermission,
  evaluateNamedContainerStartRefusal,
  evaluateUnownedMutationRefusal,
  verifyLoopbackPortBinding,
} from "./docker_ownership_policy.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../..");

export { EXPECTED_POSTGRES_IMAGE };

export function ownershipFilePath(role = "primary") {
  const suffix = role === "probe" ? "probe-docker-ownership" : "docker-ownership";
  return join(repoRoot, "tmp", `pk-v1-hint-e2e-${suffix}.json`);
}

function dockerInspect(containerName) {
  const result = spawnSync("docker", ["inspect", containerName], {
    encoding: "utf8",
  });
  return classifyDockerInspectResult(result);
}

export function readOwnershipRecord(role = "primary") {
  const ownershipPath = ownershipFilePath(role);
  if (!existsSync(ownershipPath)) {
    return null;
  }
  return JSON.parse(readFileSync(ownershipPath, "utf8"));
}

export function writeOwnershipRecord(record, role = "primary") {
  const ownershipPath = ownershipFilePath(role);
  writeFileSync(ownershipPath, JSON.stringify(record, null, 2) + "\n", "utf8");
}

export function removeContainerById(containerId) {
  if (!containerId || typeof containerId !== "string") {
    return { removed: false, code: "MISSING_CONTAINER_ID" };
  }
  const docker = spawnSync("docker", ["rm", "-f", containerId], {
    encoding: "utf8",
  });
  if (docker.status !== 0) {
    return { removed: false, code: "DOCKER_RM_FAILED" };
  }
  return { removed: true, containerId };
}

export function assertNoUnownedContainerBeforeMutation(
  containerName = PK_V1_HINT_E2E_CONTAINER,
  role = "primary",
) {
  const inspect = dockerInspect(containerName);
  const record = readOwnershipRecord(role);
  const decision = evaluateUnownedMutationRefusal(inspect, record, PK_V1_HINT_PACKAGE);
  if (decision.action === "refuse") {
    throw new Error(`REFUSE: foreign container blocks mutation (${decision.code})`);
  }
  if (decision.code === "DOCKER_INSPECT_ERROR") {
    throw new Error("DOCKER INSPECTION BLOCKED");
  }
}

export function verifyContainerForDestruction(
  containerName = PK_V1_HINT_E2E_CONTAINER,
  role = "primary",
) {
  const inspect = dockerInspect(containerName);
  const record = readOwnershipRecord(role);
  const expectedPort =
    role === "probe"
      ? String(process.env.PK_V1_HINT_E2E_PROBE_PG_PORT || DEFAULT_PROBE_PG_PORT)
      : String(process.env.AIEOS_TEST_PG_PORT || DEFAULT_PG_PORT);
  const permission = evaluateDestructionPermission({
    inspect,
    record,
    expectedHostPort: expectedPort,
    inspectPayload: inspect.rawPayload,
  });
  if (!permission.ok) {
    return {
      ok: false,
      missing: permission.missing === true,
      inspection_error: permission.inspection_error === true,
      code: permission.code,
    };
  }
  const binding = verifyLoopbackPortBinding(inspect.rawPayload, expectedPort);
  if (!binding.ok) {
    return { ok: false, code: "LOOPBACK_BINDING_MISMATCH" };
  }
  return { ok: true, inspect, record, code: permission.code };
}

export function startGovernedPostgresContainer({
  containerName = PK_V1_HINT_E2E_CONTAINER,
  hostPort,
  bootstrapUser = "aieos_bootstrap",
  dbPassword = "aieos_test",
  dbName = "aieos",
  role = "primary",
}) {
  assertNoUnownedContainerBeforeMutation(containerName, role);
  const ownerRunId = randomUUID();
  const existing = dockerInspect(containerName);
  const startDecision = evaluateNamedContainerStartRefusal(existing);
  if (!startDecision.ok) {
    if (startDecision.inspection_error) {
      throw new Error("DOCKER INSPECTION BLOCKED");
    }
    throw new Error(
      `REFUSE: named container already exists; will not delete foreign instance (${startDecision.code})`,
    );
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
      `${PK_V1_HINT_DOCKER_PACKAGE_LABEL}=${PK_V1_HINT_PACKAGE}`,
      "-e",
      `POSTGRES_USER=${bootstrapUser}`,
      "-e",
      `POSTGRES_PASSWORD=${dbPassword}`,
      "-e",
      `POSTGRES_DB=${dbName}`,
      "-p",
      `127.0.0.1:${hostPort}:5432`,
      EXPECTED_POSTGRES_IMAGE,
    ],
    { encoding: "utf8" },
  );
  if (run.status !== 0) {
    throw new Error("docker run failed");
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
  const binding = verifyLoopbackPortBinding(inspect.rawPayload, hostPort);
  if (!binding.ok) {
    removeContainerById(createdContainerId);
    throw new Error("governed postgres port must bind loopback only");
  }
  const record = {
    ownerRunId,
    containerId: inspect.containerId,
    containerName,
    image: inspect.image,
    hostPort: String(hostPort),
    role,
    recordedAt: new Date().toISOString(),
  };
  writeOwnershipRecord(record, role);
  return record;
}

export function removeOwnedContainer(
  containerName = PK_V1_HINT_E2E_CONTAINER,
  role = "primary",
) {
  const verified = verifyContainerForDestruction(containerName, role);
  if (verified.inspection_error) {
    return { removed: false, inspection_error: true, code: verified.code };
  }
  if (verified.missing) {
    return { removed: false, missing: true, code: verified.code };
  }
  if (!verified.ok) {
    return { removed: false, code: verified.code || "DESTRUCTION_DENIED" };
  }
  const docker = spawnSync(
    "docker",
    ["rm", "-f", verified.record.containerId],
    { encoding: "utf8" },
  );
  if (docker.status !== 0) {
    return { removed: false, code: "DOCKER_RM_FAILED" };
  }
  return { removed: true, containerId: verified.record.containerId };
}

export function defaultContainerNameForRole(role) {
  return role === "probe" ? PK_V1_HINT_E2E_PROBE_CONTAINER : PK_V1_HINT_E2E_CONTAINER;
}