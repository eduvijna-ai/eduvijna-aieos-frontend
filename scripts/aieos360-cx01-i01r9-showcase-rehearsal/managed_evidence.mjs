import { createServer } from "node:net";
import {
  DEFAULT_PARENT_BACKEND_PORT,
  DEFAULT_PARENT_FRONTEND_PORT,
  DEFAULT_PRINCIPAL_BACKEND_PORT,
  DEFAULT_PRINCIPAL_FRONTEND_PORT,
  DEFAULT_STUDENT_BACKEND_PORT,
  DEFAULT_STUDENT_FRONTEND_PORT,
  DEFAULT_TEACHER_BACKEND_PORT,
  DEFAULT_TEACHER_FRONTEND_PORT,
} from "./constants.mjs";
import {
  isPidAlive,
  readProcessRegistry,
  verifyRegistryEntry,
} from "./process_group.mjs";

export const DEFAULT_GOVERNED_APP_PORTS = [
  DEFAULT_TEACHER_BACKEND_PORT,
  DEFAULT_STUDENT_BACKEND_PORT,
  DEFAULT_PRINCIPAL_BACKEND_PORT,
  DEFAULT_PARENT_BACKEND_PORT,
  DEFAULT_TEACHER_FRONTEND_PORT,
  DEFAULT_STUDENT_FRONTEND_PORT,
  DEFAULT_PRINCIPAL_FRONTEND_PORT,
  DEFAULT_PARENT_FRONTEND_PORT,
];

export function listLiveManagedEntries() {
  const registry = readProcessRegistry();
  const live = [];
  for (const entry of registry.children ?? []) {
    if (verifyRegistryEntry(entry).ok) {
      live.push(entry);
    }
  }
  return live;
}

export async function assertPortsReleased(ports) {
  const blocked = [];
  for (const port of ports) {
    try {
      await new Promise((resolve, reject) => {
        const server = createServer();
        server.once("error", reject);
        server.listen(port, "127.0.0.1", () => {
          server.close(() => resolve(undefined));
        });
      });
    } catch {
      blocked.push(port);
    }
  }
  if (blocked.length > 0) {
    throw new Error(`ports still held: ${blocked.join(", ")}`);
  }
}

export function collectManagedEvidence() {
  const live = listLiveManagedEntries();
  return {
    live_process_count: live.length,
    live_processes: live.map((e) => ({ role: e.role, pid: e.pid, port: e.port })),
    any_pid_alive: live.some((e) => isPidAlive(e.pid)),
  };
}
