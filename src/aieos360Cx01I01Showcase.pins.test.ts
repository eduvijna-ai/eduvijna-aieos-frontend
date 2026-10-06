import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const CX01_ARCHITECTURE = "491295c3cf0a151f31686a6a2e1a2176cd92c782";
const CX01_PRODUCT = "b4b3048fb7a6a1c50ae8619dc490743714f2e3e2";
const CX01_INFRASTRUCTURE = "a8654e5bc680eac1fa93cf8308d7cad904f4d7b9";
const CX01_FRONTEND_BASE = "80125be6cf172afb5137e845752c5b4505e5a97f";
const CX01_BACKEND = "637583f42b7c475ef83f6f99bca7e65e665a253d";
const CX01_OPENAPI =
  "4042FB2725DA70A02A70EE09563B7698AE2E5DA82927614CAF1B5F7E6AA7C1D0";
const CX01_ALEMBIC = "a360s010004";
const CX01_SCENARIO = "aieos360-cx01-i01-showcase-rehearsal";
const CX01_CONTAINER = "aieos-aieos360-cx01-i01-showcase-pg";

const I03_BACKEND = "637583f42b7c475ef83f6f99bca7e65e665a253d";
const I03_FRONTEND_BASE = "20a06f048510a2519e0487d12ea7c16f59e7fd7c";

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("AIEOS360-CX01-I01 showcase rehearsal pin and safety consistency", () => {
  it("pins governed Architecture/Product/Infrastructure/Frontend/Backend/OpenAPI/Alembic exactly", () => {
    const constants = read(
      "scripts/aieos360-cx01-i01-showcase-rehearsal/constants.mjs",
    );
    expect(constants).toContain(CX01_ARCHITECTURE);
    expect(constants).toContain(CX01_PRODUCT);
    expect(constants).toContain(CX01_INFRASTRUCTURE);
    expect(constants).toContain(CX01_FRONTEND_BASE);
    expect(constants).toContain(CX01_BACKEND);
    expect(constants).toContain(CX01_OPENAPI);
    expect(constants).toContain(CX01_ALEMBIC);
    expect(constants).toContain(CX01_SCENARIO);
    expect(constants).toContain(CX01_CONTAINER);

    const seed = read(
      "scripts/aieos360-cx01-i01-showcase-rehearsal/seed_precondition.py",
    );
    expect(seed).toContain(`BACKEND_PIN_SHA = "${CX01_BACKEND}"`);
    expect(seed).toContain(`EXPECTED_MIGRATION_HEAD = "${CX01_ALEMBIC}"`);
    expect(seed).toContain(`SCENARIO_ID = "${CX01_SCENARIO}"`);
    expect(seed).toContain("DevelopmentCoherentSchoolContextProvider");
    expect(seed).toContain('"harness_parent_learner_mapping": None');
    expect(seed).toContain('"harness_teacher_authority_map": None');

    const bootstrap = read(
      "scripts/aieos360-cx01-i01-showcase-rehearsal/bootstrap_database.py",
    );
    expect(bootstrap).toContain(CX01_ALEMBIC);
    expect(bootstrap).toContain("reset_safety");
  });

  it("exposes operator reset/start/status/stop commands and dedicated rehearsal ports", () => {
    const pkg = read("package.json");
    expect(pkg).toContain('"showcase:aieos360:reset"');
    expect(pkg).toContain('"showcase:aieos360:start"');
    expect(pkg).toContain('"showcase:aieos360:status"');
    expect(pkg).toContain('"showcase:aieos360:stop"');

    const constants = read(
      "scripts/aieos360-cx01-i01-showcase-rehearsal/constants.mjs",
    );
    expect(constants).toContain("55448");
    expect(constants).toContain("8020");
    expect(constants).toContain("5291");
  });

  it("composes DevelopmentCoherentSchoolContextProvider defaults on all four role surfaces", () => {
    for (const role of ["teacher", "student", "principal", "parent"] as const) {
      const serve = read(
        `scripts/aieos360-cx01-i01-showcase-rehearsal/serve_${role}_app.py`,
      );
      expect(serve).toContain("DevelopmentCoherentSchoolContextProvider()");
      expect(serve).not.toContain("set_teacher_class_authority");
      expect(serve).not.toContain("PrincipalKind.ADMIN");
      expect(serve).not.toContain("admin.");
    }
  });

  it("keeps historical S04-I03 pins and container identity unchanged", () => {
    const s04 = read("scripts/aieos360-s04-i03-e2e/constants.mjs");
    expect(s04).toContain(I03_BACKEND);
    expect(s04).toContain(I03_FRONTEND_BASE);
    expect(s04).toContain("aieos-aieos360-s04-i03-e2e-pg");
    expect(s04).not.toContain(CX01_CONTAINER);
    expect(s04).not.toContain(CX01_SCENARIO);
  });

  it("adds CI lane with pin guard and proof scripts", () => {
    const ci = read(".github/workflows/ci.yml");
    expect(ci).toContain("aieos360-cx01-i01-showcase:");
    expect(ci).toContain(`AIEOS_BACKEND_PIN_SHA: ${CX01_BACKEND}`);
    expect(ci).toContain(`ref: ${CX01_BACKEND}`);
    expect(ci).toContain(CX01_OPENAPI);
    expect(ci).toContain(CX01_ALEMBIC);
    expect(ci).toContain("pnpm test:cx01-i01-showcase-proof");
  });

  it("keeps CX01 integration proofs opt-in only (not generic CI/Docker)", () => {
    const proof = read("src/aieos360Cx01I01Showcase.proof.test.ts");
    expect(proof).toContain(
      'process.env.AIEOS360_CX01_I01_SHOWCASE_INTEGRATION === "1"',
    );
    expect(proof).not.toContain('process.env.CI === "true"');
    expect(proof).not.toMatch(/CI\s*===\s*["']true["']/);

    const pkg = read("package.json");
    expect(pkg).toContain("AIEOS360_CX01_I01_SHOWCASE_INTEGRATION=1");
    expect(pkg).toContain("test:cx01-i01-showcase-proof");
  });
});
