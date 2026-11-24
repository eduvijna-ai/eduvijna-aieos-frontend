/**
 * Governed local webserver port release checks before owned PG teardown.
 * Never kills foreign processes — tri-state probe; UNKNOWN blocks DB destruction.
 */

import net from "node:net";

/** Fixed governed loopback bindings — no env override (prevents hiding live servers). */
export const GOVERNED_LOCAL_PORTS = Object.freeze([8028, 8029, 5191, 5192]);
export const GOVERNED_LOOPBACK_HOST = "127.0.0.1";

/** @typedef {"LISTENING" | "CLOSED" | "UNKNOWN"} PortProbeState */

/**
 * @typedef {object} PortProbe
 * @property {(host: string, port: number) => Promise<PortProbeState>} probePort
 */

export function governedLocalPorts() {
  return [...GOVERNED_LOCAL_PORTS];
}

/**
 * Only literal CLOSED is accepted as released; every other signal is UNKNOWN.
 * @param {unknown} state
 * @returns {PortProbeState}
 */
export function normalizePortProbeState(state) {
  if (state === "CLOSED") {
    return "CLOSED";
  }
  if (state === "LISTENING") {
    return "LISTENING";
  }
  return "UNKNOWN";
}

function validateGovernedPortBinding(host) {
  const ports = governedLocalPorts();
  if (host !== GOVERNED_LOOPBACK_HOST) {
    return { valid: false, reason: "NON_LOOPBACK_HOST" };
  }
  if (ports.length !== GOVERNED_LOCAL_PORTS.length) {
    return { valid: false, reason: "PORT_SET_DRIFT" };
  }
  for (const port of ports) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return { valid: false, reason: "INVALID_PORT_RANGE" };
    }
  }
  if (new Set(ports).size !== ports.length) {
    return { valid: false, reason: "DUPLICATE_GOVERNED_PORT" };
  }
  return { valid: true, ports };
}

/** @returns {PortProbe} */
export function createTcpPortProbe() {
  return {
    probePort(host, port) {
      return new Promise((resolve) => {
        const socket = net.createConnection({ host, port });
        let settled = false;
        const finish = (state) => {
          if (settled) {
            return;
          }
          settled = true;
          socket.destroy();
          resolve(state);
        };
        socket.setTimeout(250);
        socket.on("connect", () => finish("LISTENING"));
        socket.on("timeout", () => finish("UNKNOWN"));
        socket.on("error", (err) => {
          if (err && err.code === "ECONNREFUSED") {
            finish("CLOSED");
          } else {
            finish("UNKNOWN");
          }
        });
      });
    },
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {PortProbe} probe
 * @param {string} host
 * @param {number} port
 */
async function safeProbePort(probe, host, port) {
  try {
    const raw = await probe.probePort(host, port);
    return normalizePortProbeState(raw);
  } catch {
    return "UNKNOWN";
  }
}

/**
 * @param {PortProbe} [probe]
 * @param {string} [host]
 * @param {{ maxRetries?: number; retryDelayMs?: number }} [options]
 */
export async function verifyGovernedWebserversReleased(
  probe = createTcpPortProbe(),
  host = GOVERNED_LOOPBACK_HOST,
  options = {},
) {
  const binding = validateGovernedPortBinding(host);
  if (!binding.valid) {
    return {
      released: false,
      occupiedPorts: [],
      unknownPorts: [...GOVERNED_LOCAL_PORTS],
      ambiguous: true,
      bindingReason: binding.reason,
    };
  }

  const maxRetries = options.maxRetries ?? 3;
  const retryDelayMs = options.retryDelayMs ?? 40;
  const occupiedPorts = [];
  const unknownPorts = [];

  for (const port of binding.ports) {
    let state = await safeProbePort(probe, host, port);
    let attempts = 0;
    while (attempts < maxRetries && state !== "CLOSED") {
      if (state === "LISTENING" || state === "UNKNOWN") {
        await delay(retryDelayMs);
        state = await safeProbePort(probe, host, port);
        attempts += 1;
        continue;
      }
      state = "UNKNOWN";
      break;
    }

    if (state === "CLOSED") {
      continue;
    }
    if (state === "LISTENING") {
      occupiedPorts.push(port);
    } else {
      unknownPorts.push(port);
    }
  }

  const ambiguous = occupiedPorts.length > 0 || unknownPorts.length > 0;
  return {
    released: !ambiguous,
    occupiedPorts,
    unknownPorts,
    ambiguous,
  };
}

export function allowDatabaseTeardownAfterWebservers(state) {
  if (!state || state.ambiguous === true) {
    return false;
  }
  if ((state.unknownPorts || []).length > 0) {
    return false;
  }
  if ((state.occupiedPorts || []).length > 0) {
    return false;
  }
  return state.released === true;
}

/**
 * Fail-closed webserver gate shared with the managed E2E wrapper.
 * @param {{ closed?: boolean } | null | undefined} childState
 * @param {PortProbe} [probe]
 */
export async function evaluateWebserverReleaseGate(childState, probe = createTcpPortProbe()) {
  if (!childState || childState.closed !== true) {
    return {
      released: false,
      skipped: true,
      reason: "CHILD_NOT_CLOSED",
      lifecycleUncertain: true,
      occupiedPorts: [],
      unknownPorts: [],
      ambiguous: true,
    };
  }

  let webState;
  try {
    webState = await verifyGovernedWebserversReleased(probe);
  } catch {
    webState = {
      released: false,
      occupiedPorts: [],
      unknownPorts: [...GOVERNED_LOCAL_PORTS],
      ambiguous: true,
      probeRejected: true,
    };
  }

  if (!allowDatabaseTeardownAfterWebservers(webState)) {
    const reason =
      (webState.unknownPorts || []).length > 0
        ? "WEBSERVER_PORT_UNKNOWN"
        : (webState.occupiedPorts || []).length > 0
          ? "PORTS_STILL_LISTENING"
          : webState.bindingReason || "WEBSERVER_RELEASE_UNCERTAIN";
    return {
      ...webState,
      skipped: false,
      reason,
      lifecycleUncertain: true,
    };
  }

  return {
    ...webState,
    skipped: false,
    reason: null,
    lifecycleUncertain: false,
  };
}