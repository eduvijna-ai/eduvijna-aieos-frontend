import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

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

  it("documents coverage matrix and runbook", () => {
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
    expect(runbook).toContain("e7ff20b84ce8edabf1c849e8c19a7340cbaebcfa");
    expect(runbook).toContain("REAL_AI live generation: PENDING");
  });

  it("wires CI job for CX01-I07 integrated guard", () => {
    const ci = readFileSync(
      path.join(repoRoot, ".github/workflows/ci.yml"),
      "utf8",
    );
    expect(ci).toContain("aieos360-cx01-i07-e2e");
    expect(ci).toContain("pnpm test:e2e:aieos360-cx01-i07");
  });
});
