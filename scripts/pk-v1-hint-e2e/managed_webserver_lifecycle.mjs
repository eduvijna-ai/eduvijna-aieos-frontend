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
      unknownPorts: [],
      ambiguous: true,
      bindingReason: binding.reason,
    };
  }

  const maxRetries = options.maxRetries ?? 3;
  const retryDelayMs = options.retryDelayMs ?? 40;
  const occupiedPorts = [];
  const unknownPorts = [];

  for (const port of binding.ports) {
    let state = await probe.probePort(host, port);
    let attempts = 0;
    while (attempts < maxRetries && state !== "CLOSED") {
      if (state === "LISTENING" || state === "UNKNOWN") {
        await delay(retryDelayMs);
        state = await probe.probePort(host, port);
        attempts += 1;
        continue;
      }
      break;
    }

    if (state === "LISTENING") {
      occupiedPorts.push(port);
    } else if (state === "UNKNOWN") {
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