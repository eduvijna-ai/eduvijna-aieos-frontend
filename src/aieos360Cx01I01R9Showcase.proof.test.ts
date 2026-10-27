import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  assertNoProviderSecretsInEnv,
  buildProofSubprocessEnv,
} from "../scripts/aieos360-cx01-i06-showcase-ai-mode/proof_subprocess_env.mjs";

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
const i06ScriptDir = path.join(
  repoRoot,
  "scripts/aieos360-cx01-i06-showcase-ai-mode",
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
  it("scrubs all provider-secret aliases from proof subprocess env", () => {
    const sentinel = "synthetic-sentinel-must-not-leak";
    process.env.AIEOS_GROQ_API_KEY = sentinel;
    process.env.OPENAI_API_KEY = sentinel;
    process.env.GROQ_API_KEY = sentinel;
    process.env.AZURE_OPENAI_API_KEY = sentinel;
    process.env.ANTHROPIC_API_KEY = sentinel;
    const scrubbed = buildProofSubprocessEnv({ AIEOS_BACKEND_ROOT: "/tmp/fake" });
    assertNoProviderSecretsInEnv(scrubbed);
    for (const key of [
      "AIEOS_GROQ_API_KEY",
      "OPENAI_API_KEY",
      "GROQ_API_KEY",
      "AZURE_OPENAI_API_KEY",
      "ANTHROPIC_API_KEY",
    ]) {
      delete process.env[key];
    }
  });

  it.runIf(backendReady)(
    "I06 provider aggregator tenant header contract (Backend TestClient, synthetic Groq composition only)",
    () => {
      const backendRoot = process.env.AIEOS_BACKEND_ROOT;
      if (!backendRoot) {
        throw new Error("AIEOS_BACKEND_ROOT is required");
      }
      const proofEnv = buildProofSubprocessEnv({
        AIEOS_BACKEND_ROOT: backendRoot,
        PYTHONPATH: [
          path.join(backendRoot, "src"),
          backendRoot,
          i06ScriptDir,
        ].join(path.delimiter),
      });
      assertNoProviderSecretsInEnv(proofEnv);
      const contractProof = spawnSync(
        process.env.AIEOS360_CX01_I01_SHOWCASE_UV || "uv",
        [
          "run",
          "python",
          path.join(i06ScriptDir, "provider_aggregator_tenant_contract_proof.py"),
        ],
        {
          cwd: backendRoot,
          env: proofEnv,
          encoding: "utf8",
        },
      );
      if (contractProof.status !== 0) {
        console.error(contractProof.stdout);
        console.error(contractProof.stderr);
      }
      expect(contractProof.stdout).toContain("provider_aggregator_tenant_contract");
      expect(contractProof.status).toBe(0);
    },
  );

  it.runIf(backendReady && process.platform === "linux")(
    "I06R3 forced reset failure clears stale runtime surface before exiting (entrypoint)",
    () => {
      const surfaceDir = mkdtempSync(path.join(tmpdir(), "cx01-i06-reset-proof-"));
      const surfacePath = path.join(surfaceDir, "runtime.json");
      writeFileSync(
        surfacePath,
        JSON.stringify(
          {
            runtime_surface_valid: true,
            selected_mode: "REAL_AI",
            active_provider_id: "groq",
            verification_state: "real_provider_runtime_observed",
          },
          null,
          2,
        ) + "\n",
        "utf8",
      );

      const reset = spawnSync(
        "node",
        [path.join(scriptDir, "reset.mjs")],
        {
          cwd: repoRoot,
          env: {
            ...process.env,
            AIEOS360_CX01_I06_RUNTIME_SURFACE_PATH: surfacePath,
            AIEOS360_CX01_I01_SHOWCASE_FORCE_RESET_FAIL: "1",
          },
          encoding: "utf8",
        },
      );
      expect(reset.status).not.toBe(0);

      const payload = JSON.parse(readFileSync(surfacePath, "utf8"));
      expect(payload.runtime_surface_valid).toBe(false);
      expect(payload.verification_state).toBe("reset_preflight");
    },
  );

  it.runIf(backendReady && process.platform === "linux")(
    "I06R3 invalid REAL_AI start preflight clears stale runtime surface before failing",
    () => {
      const surfaceDir = mkdtempSync(path.join(tmpdir(), "cx01-i06-start-proof-"));
      const surfacePath = path.join(surfaceDir, "runtime.json");
      writeFileSync(
        surfacePath,
        JSON.stringify(
          {
            runtime_surface_valid: true,
            selected_mode: "REAL_AI",
            active_provider_id: "groq",
          },
          null,
          2,
        ) + "\n",
        "utf8",
      );

      const start = spawnSync(
        "node",
        [path.join(scriptDir, "start.mjs")],
        {
          cwd: repoRoot,
          env: buildProofSubprocessEnv({
            AIEOS360_CX01_I06_RUNTIME_SURFACE_PATH: surfacePath,
            AIEOS360_CX01_I06_SHOWCASE_MODE: "REAL_AI",
            AIEOS_AI_PROVIDER: "groq",
            AIEOS360_CX01_I01_SHOWCASE_SKIP_RESET: "1",
          }),
          encoding: "utf8",
        },
      );
      expect(start.status).not.toBe(0);

      const payload = JSON.parse(readFileSync(surfacePath, "utf8"));
      expect(payload.runtime_surface_valid).toBe(false);
      expect(payload.verification_state).toBe("managed_start_preflight");
    },
  );

  it("shared stop-wide deadline selftest", () => {
    const result = runNodeProof("process_group_stop.selftest.mjs");
    if (result.status !== 0) {
      console.error(result.stdout);
      console.error(result.stderr);
    }
    expect(result.status).toBe(0);
  });

  it("bootstrap failure removes owned local PostgreSQL container", () => {
    const result = runNodeProof("bootstrap_failure_cleanup.selftest.mjs");
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

  it.runIf(runIntegration || runOwnedLocalPgProof)(
    "publish sanitized proof exports after all proof-producing tests",
    () => {
      const publish = runUvPython("publish_proof_exports.py");
      if (publish.status !== 0) {
        console.error(publish.stdout);
        console.error(publish.stderr);
      }
      expect(publish.status).toBe(0);
    },
    120_000,
  );
});
