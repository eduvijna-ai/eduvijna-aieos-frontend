import { mkdtempSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const I06_SCRIPT_PKG = "scripts/aieos360-cx01-i06-showcase-ai-mode";
const I01_SCRIPT_PKG = "scripts/aieos360-cx01-i01r9-showcase-rehearsal";
const GOVERNED_FRONTEND = "8c8247afda0b9a34e688d2c300d46e83526bb126";
const I06_AUTHORIZATION_FRONTEND = GOVERNED_FRONTEND;
const POST_MERGE_MAIN_SIMULATION = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function runNode(scriptRelativePath: string, extraEnv: Record<string, string> = {}) {
  return spawnSync("node", [path.join(repoRoot, scriptRelativePath)], {
    cwd: repoRoot,
    env: { ...process.env, ...extraEnv },
    encoding: "utf8",
  });
}

describe("AIEOS360-CX01-I06 showcase AI mode governance", () => {
  it("pins governed frontend authorization SHA without binding evergreen tests to remote main", () => {
    expect(read(`${I01_SCRIPT_PKG}/constants.mjs`)).toContain(I06_AUTHORIZATION_FRONTEND);
    expect(read(`${I06_SCRIPT_PKG}/constants.mjs`)).toContain(I06_AUTHORIZATION_FRONTEND);
  });

  it("defaults to DETERMINISTIC and rejects invalid REAL_AI without operator secrets in harness children", () => {
    const selftest = runNode(`${I06_SCRIPT_PKG}/i06_mode.selftest.mjs`);
    expect(selftest.status).toBe(0);

    const start = read(`${I01_SCRIPT_PKG}/start.mjs`);
    expect(start).toContain("resolveShowcaseModeForStart");
    expect(start).toContain("scrubAllProviderSurface");
    expect(start).toContain("buildTeacherBackendEnv");
    expect(start).not.toContain("REAL_AI query");
  });

  it("keeps teacher REAL_AI composition in serve_teacher_app without fake fallback", () => {
    const teacher = read(`${I01_SCRIPT_PKG}/serve_teacher_app.py`);
    expect(teacher).toContain("compose_configured_model_provider");
    expect(teacher).toContain("REAL_AI showcase mode cannot compose Development Fake gateway");
    expect(teacher).toContain("provider_runtime=provider_runtime");
  });

  it("scrubs provider secrets from python harness helpers", () => {
    const runPython = read(`${I01_SCRIPT_PKG}/run-python.mjs`);
    expect(runPython).toContain("scrubAllProviderSurface");
  });

  it("surfaces operator-verified runtime truth in launcher without browser aggregator fetch", () => {
    const launcher = read("src/features/aieos360-showcase/Aieos360ShowcaseLauncherPage.tsx");
    expect(launcher).toContain("ShowcaseModeTruthPanel");
    const panel = read("src/features/aieos360-showcase/ShowcaseModeTruthPanel.tsx");
    const runtimeTruth = read("src/features/aieos360-showcase/showcaseRuntimeTruth.ts");
    expect(runtimeTruth).toContain("aieos360-showcase-runtime.json");
    expect(panel).toContain("loadShowcaseRuntimeTruth");
    expect(panel).not.toContain("/api/v1/platform/ai/providers");
    expect(panel).not.toMatch(/API_KEY|bearer/i);
    expect(read(".gitignore")).toContain("public/aieos360-showcase-runtime.json");
  });

  it("validates governed source pins via injected refs without binding evergreen CI to remote main", () => {
    const result = spawnSync(
      "node",
      [
        "--input-type=module",
        "-e",
        `import { compareGovernedSourceRefs } from './${I06_SCRIPT_PKG}/source_gate.mjs';
import { GOVERNED_SOURCE_REFS } from './${I06_SCRIPT_PKG}/constants.mjs';
const authorizationRefs = Object.fromEntries(
  Object.entries(GOVERNED_SOURCE_REFS).map(([name, entry]) => [name, entry.sha]),
);
compareGovernedSourceRefs(authorizationRefs);
const postMerge = { ...authorizationRefs, frontend: '${POST_MERGE_MAIN_SIMULATION}' };
let rejected = false;
try {
  compareGovernedSourceRefs(postMerge);
} catch {
  rejected = true;
}
if (!rejected) process.exit(2);`,
      ],
      { cwd: repoRoot, encoding: "utf8" },
    );
    if (result.status !== 0) {
      console.error(result.stdout);
      console.error(result.stderr);
    }
    expect(result.status).toBe(0);
    expect(read(`${I06_SCRIPT_PKG}/source_gate.mjs`)).toContain(
      "compareGovernedSourceRefs",
    );
  });

  it("never treats provider aggregator composition as live generation proof", () => {
    const result = spawnSync(
      "node",
      [
        "--input-type=module",
        "-e",
        `import { summarizeProviderTruth } from './${I06_SCRIPT_PKG}/provider_truth.mjs';
const truth = summarizeProviderTruth('REAL_AI', {
  active_provider_id: 'groq',
  active_model_id: 'openai/gpt-oss-120b',
  mode: 'REAL',
});
if (truth.real_provider_generation_verified) process.exit(2);
if (!truth.real_provider_runtime_verified) process.exit(3);
if (truth.verification_state !== 'real_provider_runtime_observed') process.exit(4);`,
      ],
      { cwd: repoRoot, encoding: "utf8" },
    );
    expect(result.status).toBe(0);
  });

  it("sends governed synthetic tenant header for operator provider aggregator reads", () => {
    const result = spawnSync(
      "node",
      [
        "--input-type=module",
        "-e",
        `import { buildTeacherProviderAggregatorRequestHeaders } from './${I06_SCRIPT_PKG}/provider_truth.mjs';
const headers = buildTeacherProviderAggregatorRequestHeaders();
if (headers['X-AIEOS-Tenant-ID'] !== '71b5fb49-2bdb-56c3-ab7c-3b33e92a89f0') process.exit(2);`,
      ],
      { cwd: repoRoot, encoding: "utf8" },
    );
    expect(result.status).toBe(0);
  });

  it("normalizes REAL_AI provider env to canonical lowercase before teacher injection", () => {
    const result = spawnSync(
      "node",
      [
        "--input-type=module",
        "-e",
        `import { buildTeacherBackendEnv } from './${I06_SCRIPT_PKG}/env_scrub.mjs';
const env = buildTeacherBackendEnv({ FOO: '1' }, 'REAL_AI', {
  AIEOS_AI_PROVIDER: 'GROQ',
  AIEOS_GROQ_API_KEY: 'synthetic-test-key',
});
if (env.AIEOS_AI_PROVIDER !== 'groq') process.exit(2);`,
      ],
      { cwd: repoRoot, encoding: "utf8" },
    );
    expect(result.status).toBe(0);
  });

  it("fail-closes REAL_AI without provider key before managed role spawn", () => {
    const result = spawnSync(
      "node",
      [
        "--input-type=module",
        "-e",
        `import { resolveShowcaseModeForStart } from './${I06_SCRIPT_PKG}/mode.mjs';
try {
  resolveShowcaseModeForStart({
    AIEOS360_CX01_I06_SHOWCASE_MODE: 'REAL_AI',
    AIEOS_AI_PROVIDER: 'groq',
  });
  process.exit(3);
} catch (error) {
  if (!String(error).includes('AIEOS_GROQ_API_KEY')) process.exit(4);
}`,
      ],
      { cwd: repoRoot, encoding: "utf8" },
    );
    expect(result.status).toBe(0);
  });

  it("marks runtime surface inactive on clear and active only after managed write", () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "cx01-i06-runtime-"));
    const surfacePath = path.join(tempDir, "runtime.json");
    process.env.AIEOS360_CX01_I06_RUNTIME_SURFACE_PATH = surfacePath;

    const clear = spawnSync(
      "node",
      [
        "--input-type=module",
        "-e",
        `import { clearRuntimeSurface, writeRuntimeSurface } from './${I06_SCRIPT_PKG}/runtime_surface.mjs';
clearRuntimeSurface('managed_stack_stopped');
writeRuntimeSurface({
  selected_mode: 'DETERMINISTIC',
  verified_runtime_mode: 'DETERMINISTIC',
  verification_state: 'deterministic_fixture_runtime',
  real_provider_runtime_verified: false,
  real_provider_generation_verified: false,
  live_generation_verification: 'pending_operator_proof',
});`,
      ],
      { cwd: repoRoot, encoding: "utf8", env: { ...process.env } },
    );
    expect(clear.status).toBe(0);
    const payload = JSON.parse(readFileSync(surfacePath, "utf8"));
    expect(payload.runtime_surface_valid).toBe(true);
    expect(payload.selected_mode).toBe("DETERMINISTIC");

    const cleared = spawnSync(
      "node",
      [
        "--input-type=module",
        "-e",
        `import { clearRuntimeSurface } from './${I06_SCRIPT_PKG}/runtime_surface.mjs';
clearRuntimeSurface('reset_complete');`,
      ],
      { cwd: repoRoot, encoding: "utf8", env: { ...process.env } },
    );
    expect(cleared.status).toBe(0);
    const stale = JSON.parse(readFileSync(surfacePath, "utf8"));
    expect(stale.runtime_surface_valid).toBe(false);
    expect(stale.verification_state).toBe("reset_complete");
    delete process.env.AIEOS360_CX01_I06_RUNTIME_SURFACE_PATH;
  });

  const backendContractReady =
    Boolean(process.env.AIEOS_BACKEND_ROOT) &&
    spawnSync("uv", ["--version"], { encoding: "utf8" }).status === 0;

  it.runIf(backendContractReady)(
    "accepts Provider Aggregator tenant contract on development Backend TestClient",
    () => {
      const backendRoot = process.env.AIEOS_BACKEND_ROOT;
      const proof = spawnSync(
        process.env.AIEOS360_CX01_I01_SHOWCASE_UV || "uv",
        [
          "run",
          "python",
          path.join(repoRoot, I06_SCRIPT_PKG, "provider_aggregator_tenant_contract_proof.py"),
        ],
        {
          cwd: backendRoot,
          env: {
            ...process.env,
            AIEOS_BACKEND_ROOT: backendRoot,
            PYTHONPATH: [
              path.join(backendRoot!, "src"),
              backendRoot!,
              path.join(repoRoot, I06_SCRIPT_PKG),
            ].join(path.delimiter),
          },
          encoding: "utf8",
        },
      );
      if (proof.status !== 0) {
        console.error(proof.stdout);
        console.error(proof.stderr);
      }
      expect(proof.status).toBe(0);
    },
  );
});
