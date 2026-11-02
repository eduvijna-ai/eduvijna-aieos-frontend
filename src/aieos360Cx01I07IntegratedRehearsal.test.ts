import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  assertChildEnvHasNoProviderSecrets,
  buildI07PythonBootstrapEnv,
} from "../scripts/aieos360-cx01-i07-e2e/child_env.mjs";
import { SHOWCASE_LAUNCHER_PATH } from "./features/aieos360-showcase/showcaseContext";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

describe("AIEOS360-CX01-I07 integrated rehearsal package", () => {
  it("registers rehearse runner and E2E config in package.json", () => {
    const pkg = JSON.parse(
      readFileSync(path.join(repoRoot, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(pkg.scripts["showcase:aieos360:rehearse"]).toContain(
      "aieos360-cx01-i07-integrated-rehearsal/rehearse.mjs",
    );
    expect(pkg.scripts["test:e2e:aieos360-cx01-i07"]).toContain(
      "playwright.aieos360-cx01-i07.config.ts",
    );
  });

  it("documents coverage matrix and runbook with correct launcher path", () => {
    const matrix = readFileSync(
      path.join(repoRoot, "docs/AIEOS360-CX01-I07-COVERAGE-MATRIX.md"),
      "utf8",
    );
    expect(matrix).toContain("AIEOS360-CX-SCENARIO-01");
    expect(matrix).toContain("AUTOMATED GUARD (pending green exact-head CI)");
    expect(matrix).not.toContain("PROVEN LIVE ON SAME I07 SUBSTRATE");
    const runbook = readFileSync(
      path.join(repoRoot, "docs/AIEOS360-CX01-I07-INTEGRATED-SHOWCASE-REHEARSAL.md"),
      "utf8",
    );
    expect(runbook).toContain(SHOWCASE_LAUNCHER_PATH);
    expect(runbook).not.toContain("/aieos360/showcase");
    expect(runbook).toContain("REAL_AI live generation: PENDING");
    expect(runbook).toContain("Demonstration modes");
    const preflight = readFileSync(
      path.join(repoRoot, "docs/AIEOS360-CX01-I07-PRESENTER-PREFLIGHT.md"),
      "utf8",
    );
    expect(preflight).toContain("showcase-fixture.json");
    expect(preflight).toContain("does not contain bearer tokens");
  });

  it("CI job forbids raw credential-bearing artifact uploads", () => {
    const ci = readFileSync(
      path.join(repoRoot, ".github/workflows/ci.yml"),
      "utf8",
    );
    expect(ci).toContain("aieos360-cx01-i07-e2e");
    expect(ci).toContain("export_sanitized_ci_evidence");
    expect(ci).toContain("tmp/cx01-i07-proof-exports/");
    expect(ci).not.toContain("aieos360-cx01-i01-showcase-fixture.json");
    expect(ci).not.toContain("aieos360-cx01-i07-e2e-persistence.json");
    const i07Job = ci.slice(ci.indexOf("aieos360-cx01-i07-e2e:"));
    expect(i07Job).toContain('AIEOS360_CX01_I01_SHOWCASE_CI_EXTERNAL_PG: "1"');
    expect(i07Job).toContain("fake_gateway_preparation_kit.proof.py");
    expect(i07Job).toContain("CX01-I07 fake gateway PreparationKit contract (mandatory)");
  });

  it("rehearse runner always emits final report via orchestration", () => {
    const rehearse = readFileSync(
      path.join(
        repoRoot,
        "scripts/aieos360-cx01-i07-integrated-rehearsal/rehearse.mjs",
      ),
      "utf8",
    );
    expect(rehearse).toContain("buildRehearsalReport");
    expect(rehearse).toContain("runRehearsalOrchestration");
    expect(rehearse).toContain("assertManagedStackReady");
    expect(rehearse).toContain("verifyOwnedRegistryClear");
    expect(rehearse).not.toContain("STATUS_SKIP_LIVE");
    const orchestration = readFileSync(
      path.join(
        repoRoot,
        "scripts/aieos360-cx01-i07-integrated-rehearsal/rehearse_orchestration.mjs",
      ),
      "utf8",
    );
    expect(orchestration).toContain("resolveCleanupPlan");
    expect(orchestration).toContain("ownedStartAttempted");
    expect(orchestration).not.toMatch(/catch[\s\S]*writeReport\(/);
  });

  it("student assignment pass-kit contract enforces transport separation (selftest)", () => {
    const result = spawnSync(
      "node",
      [
        path.join(
          repoRoot,
          "scripts/aieos360-cx01-i07-integrated-rehearsal/student_assignment_pass_kit_contract.selftest.mjs",
        ),
      ],
      { encoding: "utf8" },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("pass");
  });

  it("work artifacts contract uses artifact_kind DTO (selftest)", () => {
    const result = spawnSync(
      "node",
      [
        path.join(
          repoRoot,
          "scripts/aieos360-cx01-i07-integrated-rehearsal/work_artifacts_contract.selftest.mjs",
        ),
      ],
      { encoding: "utf8" },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("pass");
  });

  it("rehearse orchestration bounded scenarios (selftest)", () => {
    const result = spawnSync(
      "node",
      [
        path.join(
          repoRoot,
          "scripts/aieos360-cx01-i07-integrated-rehearsal/rehearse_orchestration.selftest.mjs",
        ),
      ],
      { encoding: "utf8" },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("pass");
  });

  it("rehearsal report sanitizer strips credential markers (selftest)", () => {
    const result = spawnSync(
      "node",
      [
        path.join(
          repoRoot,
          "scripts/aieos360-cx01-i07-integrated-rehearsal/rehearse_report_sanitize.selftest.mjs",
        ),
      ],
      { encoding: "utf8" },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("pass");
  });

  it("optional local fake proof subprocess env scrubs provider secrets", () => {
    const scrubbed = buildI07PythonBootstrapEnv(
      {
        ...process.env,
        OPENAI_API_KEY: "synthetic-sentinel-must-not-leak",
        AIEOS_GROQ_API_KEY: "synthetic-sentinel-must-not-leak",
      },
      { AIEOS_BACKEND_ROOT: "/tmp/nonexistent-backend-for-scrub-test" },
    );
    assertChildEnvHasNoProviderSecrets(
      scrubbed,
      "optional-local-fake-gateway-proof",
    );
  });

  const backendRoot = path.join(repoRoot, "backend");
  const backendReady =
    existsSync(path.join(backendRoot, "src")) &&
    existsSync(path.join(backendRoot, "pyproject.toml"));
  const uvAvailable =
    spawnSync("uv", ["--version"], { encoding: "utf8" }).status === 0;

  it.runIf(backendReady && uvAvailable)(
    "optional local fake gateway PreparationKit proof (developer)",
    () => {
      const result = spawnSync(
        "uv",
        [
          "run",
          "python",
          path.join(
            repoRoot,
            "scripts/aieos360-cx01-i01r9-showcase-rehearsal/fake_gateway_preparation_kit.proof.py",
          ),
        ],
        {
          cwd: backendRoot,
          env: buildI07PythonBootstrapEnv(process.env, {
            AIEOS_BACKEND_ROOT: backendRoot,
          }),
          encoding: "utf8",
        },
      );
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("fake_gateway_preparation_kit.proof: pass");
    },
  );

  it("child env builders scrub provider secrets (selftest)", () => {
    const result = spawnSync(
      "node",
      [
        path.join(
          repoRoot,
          "scripts/aieos360-cx01-i07-e2e/child_env.selftest.mjs",
        ),
      ],
      { encoding: "utf8" },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("pass");
  });

  it("rehearse lifecycle selftest (status gate + ownership)", () => {
    const result = spawnSync(
      "node",
      [
        path.join(
          repoRoot,
          "scripts/aieos360-cx01-i07-integrated-rehearsal/rehearse_lifecycle.selftest.mjs",
        ),
      ],
      { encoding: "utf8" },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("pass");
  });
});
