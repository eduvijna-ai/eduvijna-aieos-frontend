/** Pure Docker inspect classification (testable without daemon). */

export const CX01_DOCKER_OWNER_LABEL = "aieos360.cx01.owner";
export const CX01_DOCKER_PACKAGE_LABEL = "aieos360.cx01.package";

export function classifyDockerInspectResult({ status, stdout, stderr }) {
  if (status !== 0) {
    const message = `${stderr || ""}\n${stdout || ""}`.toLowerCase();
    if (
      message.includes("no such object") ||
      message.includes("not found") ||
      message.includes("error response from daemon: no such container")
    ) {
      return { state: "not_found" };
    }
    return {
      state: "error",
      error: (stderr || stdout || "docker inspect failed").trim(),
    };
  }
  if (!stdout?.trim()) {
    return { state: "not_found" };
  }
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return { state: "error", error: "docker inspect returned invalid JSON" };
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || !parsed[0]?.Id) {
    return { state: "not_found" };
  }
  const container = parsed[0];
  const labels = container?.Config?.Labels ?? {};
  return {
    state: "ok",
    containerId: container.Id,
    image: container.Config?.Image,
    ownerLabel: labels[CX01_DOCKER_OWNER_LABEL] ?? null,
    packageLabel: labels[CX01_DOCKER_PACKAGE_LABEL] ?? null,
  };
}
