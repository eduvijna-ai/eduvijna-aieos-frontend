import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { runtimeSurfacePath } from "./paths.mjs";

export function writeRuntimeSurface(payload) {
  mkdirSync(dirname(runtimeSurfacePath), { recursive: true });
  const sanitized = {
    classification: "NON_PRODUCTION",
    synthetic_rehearsal: true,
    ...payload,
  };
  writeFileSync(runtimeSurfacePath, JSON.stringify(sanitized, null, 2) + "\n", "utf8");
  return runtimeSurfacePath;
}
