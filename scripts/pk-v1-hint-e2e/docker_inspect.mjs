/** Pure Docker inspect classification (testable without daemon). */

export const PK_V1_HINT_DOCKER_OWNER_LABEL = "aieos360.pk-v1-hint.owner";
export const PK_V1_HINT_DOCKER_PACKAGE_LABEL = "aieos360.pk-v1-hint.package";

const MISSING_CONTAINER_PATTERNS = [
  /no such object/i,
  /error response from daemon:\s*no such container/i,
];

function isMissingContainerError(message) {
  const text = message || "";
  return MISSING_CONTAINER_PATTERNS.some((pattern) => pattern.test(text));
}

export function classifyDockerInspectResult({ status, stdout, stderr }) {
  if (status !== 0) {
    const combined = `${stderr || ""}\n${stdout || ""}`;
    if (isMissingContainerError(combined)) {
      return { state: "not_found" };
    }
    return {
      state: "error",
      error: (stderr || stdout || "docker inspect failed").trim(),
    };
  }
  if (!stdout?.trim()) {
    return { state: "error", error: "docker inspect returned empty stdout" };
  }
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return { state: "error", error: "docker inspect returned invalid JSON" };
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || !parsed[0]?.Id) {
    return {
      state: "error",
      error: "docker inspect returned empty or incomplete container record",
    };
  }
  const container = parsed[0];
  const labels = container?.Config?.Labels ?? {};
  return {
    state: "ok",
    containerId: container.Id,
    image: container.Config?.Image,
    ownerLabel: labels[PK_V1_HINT_DOCKER_OWNER_LABEL] ?? null,
    packageLabel: labels[PK_V1_HINT_DOCKER_PACKAGE_LABEL] ?? null,
  };
}