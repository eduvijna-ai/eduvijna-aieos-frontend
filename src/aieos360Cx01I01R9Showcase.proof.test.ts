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
const externalPgReady =
  Boolean(process.env.AIEOS_TEST_DATABASE_URL) &&
  process.env.AIEOS360_CX01_I01_SHOWCASE_CI_EXTERNAL_PG === "1";
const dockerReady =
  spawnSync("docker", ["version"], { encoding: "utf8" }).status === 0;
const substrateReady = externalPgReady;
const runIntegration = integrationOptIn && backendReady && substrateReady;
const runOwnedLocalPgProof =
  integrationOptIn && backendReady && dockerReady && process.platform === "linux";

const scriptDir = path.join(
  repoRoot,
  "scripts/aieos360-cx01-i01r9-showcase-rehearsal",
);

function runUvPython(script: string) {
  const backendRoot = process.env.AIEOS_BACKEND_ROOT;
  if (!backendRoot) {
    throw new Error("AIEOS_BACKEND_ROOT is required for CX01-I01R9 integration proofs");
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

function runNodeProof(script: string, extraEnv: Record<string, string> = {}) {
  return spawnSync("node", [path.join(scriptDir, script)], {
    cwd: repoRoot,
    env: { ...process.env, ...extraEnv },
    encoding: "utf8",
  });
}

describe("AIEOS360-CX01-I01R9 showcase rehearsal proofs", () => {
  it("shared stop-wide deadline selftest", () => {
    const result = runNodeProof("process_group_stop.selftest.mjs");
    if (result.status !== 0) {
      console.error(result.stdout);
      console.error(result.stderr);
    }
    expect(result.status).toBe(0);
  });

  it.runIf(runIntegration)(
    "pin guard, repeatability, shared DB, and managed lifecycle (bounded)",
    () => {
      const repeatability = runUvPython("repeatability_proof.py");
      if (repeatability.status !== 0) {
        console.error(repeatability.stdout);
        console.error(repeatability.stderr);
      }
      expect(repeatability.status).toBe(0);

      const partialStart = runNodeProof("partial_start_cleanup_proof.mjs");
      if (partialStart.status !== 0) {
        console.error(partialStart.stdout);
        console.error(partialStart.stderr);
      }
      expect(partialStart.status).toBe(0);

      const lifecycle = runNodeProof("lifecycle_proof.mjs");
      if (lifecycle.status !== 0) {
        console.error(lifecycle.stdout);
        console.error(lifecycle.stderr);
      }
      expect(lifecycle.status).toBe(0);

      const publish = runUvPython("publish_proof_exports.py");
      expect(publish.status).toBe(0);
    },
    1_800_000,
  );

  it.runIf(runOwnedLocalPgProof)(
    "owned local PostgreSQL cleanup proof (Docker, not external CI PG)",
    () => {
      const ownedLocal = runNodeProof("owned_local_pg_cleanup_proof.mjs", {
        AIEOS360_CX01_I01_SHOWCASE_CI_EXTERNAL_PG: "",
        AIEOS_TEST_DATABASE_URL: "",
        AIEOS_TEST_BOOTSTRAP_DATABASE_URL: "",
        AIEOS_TEST_RUNTIME_DATABASE_URL: "",
      });
      if (ownedLocal.status !== 0) {
        console.error(ownedLocal.stdout);
        console.error(ownedLocal.stderr);
      }
      expect(ownedLocal.status).toBe(0);
    },
    600_000,
  );
});
