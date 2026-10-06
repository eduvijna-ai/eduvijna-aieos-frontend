import { readFileSync, writeFileSync } from "node:fs";
import { processesPath, statusPath } from "./paths.mjs";

export function readProcessRegistry() {
  try {
    return JSON.parse(readFileSync(processesPath, "utf8"));
  } catch {
    return { children: [], owner: "aieos360-cx01-i01-showcase" };
  }
}

export function writeProcessRegistry(registry) {
  writeFileSync(
    processesPath,
    JSON.stringify(
      { owner: "aieos360-cx01-i01-showcase", ...registry },
      null,
      2,
    ) + "\n",
    "utf8",
  );
}

export function isPidAlive(pid) {
  if (!pid || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function writeOperatorStatus(status) {
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
