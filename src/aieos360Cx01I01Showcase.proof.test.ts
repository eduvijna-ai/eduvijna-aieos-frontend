import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const integrationOptIn =
  process.env.AIEOS360_CX01_I01_SHOWCASE_INTEGRATION === "1";
const backendReady = Boolean(process.env.AIEOS_BACKEND_ROOT);
const dockerReady =
  spawnSync("docker", ["version"], { encoding: "utf8" }).status === 0;
const externalPgReady = Boolean(process.env.AIEOS_TEST_DATABASE_URL);
const substrateReady = dockerReady || externalPgReady;
const runIntegration = integrationOptIn && backendReady && substrateReady;

function runUvPython(script: string) {
  const backendRoot = process.env.AIEOS_BACKEND_ROOT;
  if (!backendRoot) {
    throw new Error("AIEOS_BACKEND_ROOT is required for CX01 integration proofs");
  }
  const scriptDir = path.join(
    repoRoot,
    "scripts/aieos360-cx01-i01-showcase-rehearsal",
  );
  return spawnSync(
    process.env.AIEOS360_CX01_I01_SHOWCASE_UV || "uv",
    ["run", "python", path.join(scriptDir, script)],
    {
      cwd: backendRoot,
      env: {
        ...process.env,
        AIEOS_BACKEND_ROOT: backendRoot,
        PYTHONPATH: [
          path.join(backendRoot, "src"),
          backendRoot,
          scriptDir,
        ].join(path.delimiter),
      },
      encoding: "utf8",
    },
  );
}

describe("AIEOS360-CX01-I01 showcase rehearsal proofs", () => {
  it.runIf(runIntegration)(
    "reset repeatability clears prior TeachingAssignment outputs",
    () => {
      const result = runUvPython("repeatability_proof.py");
      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
    },
    600_000,
  );
});
