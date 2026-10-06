import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { processesPath, statusPath } from "./paths.mjs";

function linuxProcessState(pid) {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    const close = stat.lastIndexOf(")");
    if (close === -1) {
      return null;
    }
    return stat.slice(close + 2).split(" ")[0] ?? null;
  } catch {
    return null;
  }
}

export function readProcessRegistry() {
  try {
    return JSON.parse(readFileSync(processesPath, "utf8"));
  } catch {
    return { children: [], owner: "aieos360-cx01-i01-showcase" };
  }
}

export function writeProcessRegistry(registry) {
  mkdirSync(dirname(processesPath), { recursive: true });
  writeFileSync(
    processesPath,
    JSON.stringify(
      {
        owner: "aieos360-cx01-i01-showcase",
        registry_version: 1,
        ...registry,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
}

export function appendProcessChild(entry) {
  const registry = readProcessRegistry();
  const children = [...(registry.children ?? []), entry];
  writeProcessRegistry({ ...registry, children });
  return entry;
}

export function isPidAlive(pid) {
  if (!pid || pid <= 0) {
    return false;
  }
  if (process.platform === "linux") {
    const state = linuxProcessState(pid);
    if (state === "Z") {
      return false;
    }
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function writeOperatorStatus(status) {
  mkdirSync(dirname(statusPath), { recursive: true });
  writeFileSync(statusPath, JSON.stringify(status, null, 2) + "\n", "utf8");
}

export async function waitForHttpOk(url, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
      if (response.ok) {
        return true;
      }
    } catch {
      /* retry */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`service not ready: ${url}`);
}
