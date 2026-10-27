import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
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
    expect(matrix).toContain("PROVEN LIVE ON SAME I07 SUBSTRATE");
    const runbook = readFileSync(
      path.join(repoRoot, "docs/AIEOS360-CX01-I07-INTEGRATED-SHOWCASE-REHEARSAL.md"),
      "utf8",
    );
    expect(runbook).toContain(SHOWCASE_LAUNCHER_PATH);
    expect(runbook).not.toContain("/aieos360/showcase");
    expect(runbook).toContain("REAL_AI live generation: PENDING");
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
  });

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
});
