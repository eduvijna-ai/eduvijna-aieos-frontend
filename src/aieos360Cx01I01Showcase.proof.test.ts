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
const externalPgReady =
  Boolean(process.env.AIEOS_TEST_DATABASE_URL) &&
  process.env.AIEOS360_CX01_I01_SHOWCASE_CI_EXTERNAL_PG === "1";
const substrateReady = dockerReady || externalPgReady;
const runIntegration = integrationOptIn && backendReady && substrateReady;

const scriptDir = path.join(
  repoRoot,
  "scripts/aieos360-cx01-i01-showcase-rehearsal",
);

function runUvPython(script: string) {
  const backendRoot = process.env.AIEOS_BACKEND_ROOT;
  if (!backendRoot) {
    throw new Error("AIEOS_BACKEND_ROOT is required for CX01 integration proofs");
  }
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

function runNodeLifecycle() {
  return spawnSync("node", [path.join(scriptDir, "lifecycle_proof.mjs")], {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf8",
  });
}

function runOperatorFailureProof() {
  return spawnSync("node", [path.join(scriptDir, "operator_failure_proof.mjs")], {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf8",
  });
}

describe("AIEOS360-CX01-I01 showcase rehearsal proofs", () => {
  it.runIf(runIntegration)(
    "repeatability and operator lifecycle proofs",
    () => {
      const repeatability = runUvPython("repeatability_proof.py");
      if (repeatability.status !== 0) {
        console.error(repeatability.stdout);
        console.error(repeatability.stderr);
      }
      expect(repeatability.status).toBe(0);

      const lifecycle = runNodeLifecycle();
      if (lifecycle.status !== 0) {
        console.error(lifecycle.stdout);
        console.error(lifecycle.stderr);
      }
      expect(lifecycle.status).toBe(0);

      const failures = runOperatorFailureProof();
      if (failures.status !== 0) {
        console.error(failures.stdout);
        console.error(failures.stderr);
      }
      expect(failures.status).toBe(0);

      const interactiveShutdown = spawnSync(
        "node",
        [path.join(scriptDir, "interactive_shutdown_proof.mjs")],
        { cwd: repoRoot, env: process.env, encoding: "utf8" },
      );
      if (interactiveShutdown.status !== 0) {
        console.error(interactiveShutdown.stdout);
        console.error(interactiveShutdown.stderr);
      }
      expect(interactiveShutdown.status).toBe(0);

      const foregroundSigint = spawnSync(
        "node",
        [path.join(scriptDir, "foreground_start_sigint_proof.mjs")],
        { cwd: repoRoot, env: process.env, encoding: "utf8" },
      );
      if (foregroundSigint.status !== 0) {
        console.error(foregroundSigint.stdout);
        console.error(foregroundSigint.stderr);
      }
      expect(foregroundSigint.status).toBe(0);

      const injected = spawnSync(
        "node",
        [path.join(scriptDir, "injected_failure_proof.mjs")],
        { cwd: repoRoot, env: process.env, encoding: "utf8" },
      );
      if (injected.status !== 0) {
        console.error(injected.stdout);
        console.error(injected.stderr);
      }
      expect(injected.status).toBe(0);

      const publish = runUvPython("publish_proof_exports.py");
      expect(publish.status).toBe(0);
    },
    1_200_000,
  );
});
