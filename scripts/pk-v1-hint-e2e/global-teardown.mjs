import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { cleanupFullPkV1HintE2e } from "./managed_lifecycle.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveCiExternal() {
  if (process.env.PK_V1_HINT_E2E_CI_EXTERNAL_PG !== "1") {
    return false;
  }
  const proc = spawnSync("python3", [join(__dirname, "ci_external_guard.py")], {
    encoding: "utf8",
    env: process.env,
  });
  return proc.status === 0;
}

export default async function globalTeardown() {
  if (process.env.PK_V1_HINT_E2E_MANAGED_WRAPPER === "1") {
    return;
  }
  cleanupFullPkV1HintE2e({ ciExternal: resolveCiExternal() });
}