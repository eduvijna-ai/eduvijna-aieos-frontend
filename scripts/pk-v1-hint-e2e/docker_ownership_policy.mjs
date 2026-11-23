/** Pure Docker ownership policy (testable without live daemon). */

export const EXPECTED_POSTGRES_IMAGE = "postgres:18";
export const PK_V1_HINT_PACKAGE = "pk-v1-hint-e2e";

export function verifyLoopbackPortBinding(inspectPayload, expectedHostPort) {
  const bindings =
    inspectPayload?.[0]?.HostConfig?.PortBindings?.["5432/tcp"] ?? [];
  if (!Array.isArray(bindings) || bindings.length === 0) {
    return { ok: false, error: "missing 5432/tcp port binding" };
  }
  const hostIp = bindings[0]?.HostIp;
  const hostPort = bindings[0]?.HostPort;
  if (hostIp !== "127.0.0.1") {
    return { ok: false, error: "postgres port must bind 127.0.0.1 only" };
  }
  if (String(hostPort) !== String(expectedHostPort)) {
    return { ok: false, error: "port binding does not match expected host port" };
  }
  return { ok: true, hostIp, hostPort: String(hostPort) };
}

export function evaluateUnownedMutationRefusal(inspect, record, packageLabel) {
  if (inspect.state === "error") {
    return { action: "refuse", code: "DOCKER_INSPECT_ERROR" };
  }
  if (inspect.state === "not_found") {
    return { action: "allow", code: "CONTAINER_NOT_FOUND" };
  }
  if (record?.containerId === inspect.containerId && record?.ownerRunId) {
    return { action: "allow", code: "OWNED_RECORD_MATCH" };
  }
  if (inspect.ownerLabel && inspect.packageLabel === packageLabel) {
    return { action: "allow", code: "OWNED_LABEL_MATCH" };
  }
  return { action: "refuse", code: "FOREIGN_CONTAINER" };
}

export function evaluateDestructionPermission({
  inspect,
  record,
  expectedHostPort,
  inspectPayload,
}) {
  if (inspect.state === "error") {
    return { ok: false, inspection_error: true, code: "DOCKER_INSPECT_ERROR" };
  }
  if (inspect.state === "not_found") {
    return { ok: false, missing: true, code: "CONTAINER_NOT_FOUND" };
  }
  if (!record?.containerId) {
    return { ok: false, code: "MISSING_OWNERSHIP_RECORD" };
  }
  if (record.containerId !== inspect.containerId) {
    return { ok: false, code: "CONTAINER_ID_MISMATCH" };
  }
  if (record.ownerRunId && inspect.ownerLabel !== record.ownerRunId) {
    return { ok: false, code: "OWNER_LABEL_MISMATCH" };
  }
  if (inspect.packageLabel !== PK_V1_HINT_PACKAGE) {
    return { ok: false, code: "PACKAGE_LABEL_MISMATCH" };
  }
  if (!inspect.image?.includes(EXPECTED_POSTGRES_IMAGE)) {
    return { ok: false, code: "UNEXPECTED_IMAGE" };
  }
  if (record.hostPort && String(record.hostPort) !== String(expectedHostPort)) {
    return { ok: false, code: "HOST_PORT_MISMATCH" };
  }
  if (inspectPayload) {
    const binding = verifyLoopbackPortBinding(inspectPayload, expectedHostPort);
    if (!binding.ok) {
      return { ok: false, code: "LOOPBACK_BINDING_MISMATCH" };
    }
  }
  return { ok: true, code: "DESTRUCTION_PERMITTED" };
}

export function evaluateNamedContainerStartRefusal(existingInspect) {
  if (existingInspect.state === "ok") {
    return { ok: false, code: "NAMED_CONTAINER_ALREADY_EXISTS" };
  }
  if (existingInspect.state === "error") {
    return { ok: false, code: "DOCKER_INSPECT_ERROR", inspection_error: true };
  }
  return { ok: true, code: "START_ALLOWED" };
}