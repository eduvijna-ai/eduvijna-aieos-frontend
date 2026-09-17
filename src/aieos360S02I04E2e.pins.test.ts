import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const I04_FRONTEND_BASE = "4b28e6b499c4593b7d962fe1ed867c2137d43bc7";
const I04_BACKEND = "e2bfce86afece6772eaf7c2f1eb18e2dd2240f1b";
const I04_OPENAPI =
  "BE60CC2A4612F77AB333088D264B9501B9AB842995AEC1539DA89EA0E8462B47";
const I04_ALEMBIC = "a360s010004";

const I05_FRONTEND_BASE = "fb5c0f9ae4cb45c8d7876662abdd2e852e318c56";
const I05_BACKEND = "3d25bb2d7ae3a6a95affdf075a75f20db48a6959";
const I05_OPENAPI =
  "7B51CE21725651B8D556B9DD6D264473DF0A2E7CAF30D722E1CC776C651FAFBB";
const TEACHER_PRODUCT_BACKEND =
  "a6a1cbb5a83fc9feec6a6f5077fcc5e60f60ab24";
const STUDENT_PRODUCT_BACKEND =
  "921d35eb08890a4e1d86cf95daf9d38cdfc4a13c";

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("AIEOS360-S02-I04-E2E pin and architecture consistency", () => {
  it("pins I04 Frontend/Backend/OpenAPI/Alembic exactly", () => {
    const constants = read("scripts/aieos360-s02-i04-e2e/constants.mjs");
    expect(constants).toContain(I04_FRONTEND_BASE);
    expect(constants).toContain(I04_BACKEND);
    expect(constants).toContain(I04_OPENAPI);
    expect(constants).toContain(I04_ALEMBIC);
    expect(constants).not.toContain(I05_BACKEND);
    expect(constants).not.toContain(I05_OPENAPI);

    const harness = read(
      "e2e-aieos360-s02-i04/support/aieos360S02I04Harness.ts",
    );
    expect(harness).toContain(`"${I04_FRONTEND_BASE}"`);
    expect(harness).toContain(`"${I04_BACKEND}"`);
    expect(harness).toContain(`"${I04_OPENAPI}"`);
    expect(harness).toContain(`"${I04_ALEMBIC}"`);

    const seed = read("scripts/aieos360-s02-i04-e2e/seed_precondition.py");
    expect(seed).toContain(`BACKEND_PIN_SHA = "${I04_BACKEND}"`);
    expect(seed).toContain(`EXPECTED_MIGRATION_HEAD = "${I04_ALEMBIC}"`);
    expect(seed).toContain("PRINCIPAL_OS_HUMAN_PRINCIPAL_ID");
    expect(seed).toContain("principal_kind=PrincipalKind.HUMAN");
    expect(seed).not.toContain("PrincipalKind.PRINCIPAL");

    const bootstrap = read(
      "scripts/aieos360-s02-i04-e2e/bootstrap_database.py",
    );
    expect(bootstrap).toContain(I04_ALEMBIC);
  });

  it("composes a harness-local Principal School Context reader for class-5a/class-5b", () => {
    const principalServe = read(
      "scripts/aieos360-s02-i04-e2e/serve_principal_app.py",
    );
    expect(principalServe).toContain("I04HarnessPrincipalSchoolScopeReader");
    expect(principalServe).toContain('class_ref="class-5a"');
    expect(principalServe).toContain('display_label="Grade 5A"');
    expect(principalServe).toContain('class_ref="class-5b"');
    expect(principalServe).toContain('display_label="Grade 5B"');
    expect(principalServe).toContain("PRINCIPAL_OS_HUMAN_PRINCIPAL_ID");
    expect(principalServe).toContain("DevelopmentPrincipalAuthenticator");
    expect(principalServe).toContain("DevelopmentSchoolIntelligencePermit");
    expect(principalServe).toContain("SqlAlchemySchoolIntelligenceFactsReader");
    expect(principalServe).toContain(
      "school_context_principal_scope_reader=principal_scope",
    );
    expect(principalServe).not.toContain("school_context_class_reader=");
    expect(principalServe).not.toContain("learner_membership_reader=");
    expect(principalServe).toContain(
      "Intentionally omit school_context_class_reader and learner_membership_reader",
    );
    expect(principalServe).not.toContain("class-6a");
    expect(principalServe).not.toContain("class-6b");
    expect(principalServe).not.toContain(
      "DevelopmentSchoolContextPrincipalScopeReader",
    );
  });

  it("does not let the Principal browser supply class/school/capability/role authority", () => {
    const spec = read(
      "e2e-aieos360-s02-i04/principal-school-intelligence.product.spec.ts",
    );
    expect(spec).toContain("connectPrincipalDevSession");
    expect(spec).toContain("SCHOOL_INTELLIGENCE_PATH");
    expect(spec).toContain('requestUrl!.pathname).toBe(SCHOOL_INTELLIGENCE_PATH)');
    expect(spec).toContain("requestUrl!.search).toBe(\"\")");
    expect(spec).not.toContain("effective_actor_id");
    expect(spec).not.toMatch(/page\.route\s*\(/);
    expect(spec).toContain("assertNoApiMocksInstalled");

    const harness = read(
      "e2e-aieos360-s02-i04/support/aieos360S02I04Harness.ts",
    );
    expect(harness).toContain("input[name=\"tenantId\"]");
    expect(harness).toContain("input[name=\"bearerToken\"]");
    expect(harness).not.toContain("input[name=\"role\"]");
    expect(harness).not.toContain("input[name=\"classRef\"]");
    expect(harness).not.toContain("input[name=\"capability\"]");
    expect(harness).toContain("must not register page.route handlers");
  });

  it("adds an additive I04 Playwright config, package script, and CI lane", () => {
    const pkg = read("package.json");
    expect(pkg).toContain(
      '"test:e2e:aieos360-s02-i04": "playwright test --config playwright.aieos360-s02-i04.config.ts"',
    );
    expect(pkg).toContain(
      '"test:e2e:aieos360-i05": "playwright test --config playwright.aieos360-i05.config.ts"',
    );

    const config = read("playwright.aieos360-s02-i04.config.ts");
    expect(config).toContain('testDir: "./e2e-aieos360-s02-i04"');
    expect(config).toContain("fullyParallel: false");
    expect(config).toContain("workers: 1");
    expect(config).toContain("retries: 0");
    expect(config).toContain("start-principal-backend.mjs");
    expect(config).toContain("5185");
    expect(config).toContain("5186");
    expect(config).toContain("5187");
    expect(config).toContain("8004");
    expect(config).toContain("8005");
    expect(config).toContain("8006");

    const ci = read(".github/workflows/ci.yml");
    expect(ci).toContain("aieos360-s02-i04-e2e:");
    expect(ci).toContain(`AIEOS_BACKEND_PIN_SHA: ${I04_BACKEND}`);
    expect(ci).toContain(`ref: ${I04_BACKEND}`);
    expect(ci).toContain("pnpm test:e2e:aieos360-s02-i04");
    expect(ci).toContain("sha256(");
    expect(ci).toContain(I04_OPENAPI);
    expect(ci).toContain(I04_ALEMBIC);

    const i04Job = ci.slice(ci.indexOf("aieos360-s02-i04-e2e:"));
    const nextJob = i04Job.search(/\n {2}[a-z0-9-]+:\n/);
    const i04JobBlock = nextJob === -1 ? i04Job : i04Job.slice(0, nextJob);
    expect(i04JobBlock).toMatch(
      /aieos360-s02-i04-e2e:[\s\S]*?permissions:\s*\n\s{2,}contents:\s*read/,
    );
    expect(i04JobBlock).not.toMatch(/actions:\s*write/);
    expect(i04JobBlock).not.toMatch(/contents:\s*write/);
    expect(i04JobBlock).toContain("postgres:18");
    expect(i04JobBlock).toContain("hashlib.sha256");
  });

  it("leaves historical I05 and product/student E2E pins unchanged", () => {
    const i05Constants = read("scripts/aieos360-i05-e2e/constants.mjs");
    expect(i05Constants).toContain(I05_BACKEND);
    expect(i05Constants).toContain(I05_OPENAPI);
    expect(i05Constants).toContain(I05_FRONTEND_BASE);
    expect(i05Constants).not.toContain(I04_BACKEND);
    expect(i05Constants).not.toContain(I04_OPENAPI);
    expect(i05Constants).not.toContain(I04_FRONTEND_BASE);

    const i05Pins = read("src/aieos360I05E2e.pins.test.ts");
    expect(i05Pins).toContain(I05_BACKEND);
    expect(i05Pins).toContain(I05_OPENAPI);
    expect(i05Pins).toContain(I05_FRONTEND_BASE);

    const teacherConstants = read("scripts/product-e2e/constants.mjs");
    expect(teacherConstants).toContain(TEACHER_PRODUCT_BACKEND);
    expect(teacherConstants).not.toContain(I04_BACKEND);

    const studentConstants = read("scripts/student-product-e2e/constants.mjs");
    expect(studentConstants).toContain(STUDENT_PRODUCT_BACKEND);
    expect(studentConstants).not.toContain(I04_BACKEND);

    const ci = read(".github/workflows/ci.yml");
    expect(ci).toContain("aieos360-s01-i05-e2e");
    expect(ci).toContain(`AIEOS_BACKEND_PIN_SHA: ${I05_BACKEND}`);
    expect(ci).toContain(`ref: ${I05_BACKEND}`);
    expect(ci).toContain(`AIEOS_BACKEND_PIN_SHA: ${TEACHER_PRODUCT_BACKEND}`);
    expect(ci).toContain(`AIEOS_BACKEND_PIN_SHA: ${STUDENT_PRODUCT_BACKEND}`);
    expect(ci).toContain("pnpm test:e2e:aieos360-i05");
    expect(ci).toContain("pnpm test:e2e:product");
    expect(ci).toContain("pnpm test:e2e:student-product");
  });
});
