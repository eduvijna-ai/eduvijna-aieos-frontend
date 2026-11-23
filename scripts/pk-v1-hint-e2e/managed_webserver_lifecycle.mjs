/**
 * Governed local webserver port release checks before owned PG teardown.
 * Never kills foreign processes — occupied ports block DB destruction.
 */

import net from "node:net";

export function governedLocalPorts() {
  return [
    Number.parseInt(process.env.PK_V1_HINT_E2E_TEACHER_BACKEND_PORT || "8028", 10),
    Number.parseInt(process.env.PK_V1_HINT_E2E_STUDENT_BACKEND_PORT || "8029", 10),
    Number.parseInt(process.env.PK_V1_HINT_E2E_TEACHER_FRONTEND_PORT || "5191", 10),
    Number.parseInt(process.env.PK_V1_HINT_E2E_STUDENT_FRONTEND_PORT || "5192", 10),
  ];
}

/**
 * @typedef {object} PortProbe
 * @property {(host: string, port: number) => Promise<boolean>} isPortListening
 */

/** @returns {PortProbe} */
export function createTcpPortProbe() {
  return {
    isPortListening(host, port) {
      return new Promise((resolve) => {
        const socket = net.createConnection({ host, port });
        let settled = false;
        const finish = (value) => {
          if (settled) {
            return;
          }
          settled = true;
          socket.destroy();
          resolve(value);
        };
        socket.setTimeout(250);
        socket.on("connect", () => finish(true));
        socket.on("timeout", () => finish(false));
        socket.on("error", () => finish(false));
      });
    },
  };
}

/**
 * @param {PortProbe} [probe]
 * @param {string} [host]
 */
export async function verifyGovernedWebserversReleased(
  probe = createTcpPortProbe(),
  host = "127.0.0.1",
) {
  const ports = governedLocalPorts();
  const occupiedPorts = [];
  for (const port of ports) {
    if (Number.isNaN(port)) {
      return { released: false, occupiedPorts: [], ambiguous: true };
    }
    const listening = await probe.isPortListening(host, port);
    if (listening) {
      occupiedPorts.push(port);
    }
  }
  return {
    released: occupiedPorts.length === 0,
    occupiedPorts,
    ambiguous: false,
  };
}

export function allowDatabaseTeardownAfterWebservers(state) {
  if (state?.ambiguous === true) {
    return false;
  }
  return state?.released === true;
}