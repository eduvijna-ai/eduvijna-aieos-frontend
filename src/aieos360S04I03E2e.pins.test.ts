import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const I03_ARCHITECTURE = "b167bfd951cf9acecb6ff2470ed0fb8c1925097e";
const I03_FRONTEND_BASE = "20a06f048510a2519e0487d12ea7c16f59e7fd7c";
const I03_BACKEND = "637583f42b7c475ef83f6f99bca7e65e665a253d";
const I03_OPENAPI =
  "4042FB2725DA70A02A70EE09563B7698AE2E5DA82927614CAF1B5F7E6AA7C1D0";
const I03_ALEMBIC = "a360s010004";

const S03_I04_ARCHITECTURE = "67f4020b78cacdf1716e18d83f4410cb16fdcb4d";
const S03_I04_FRONTEND_BASE = "04c2b1850732df1b8fe5de55f018edf30365181d";
const S03_I04_BACKEND = "138f37bfa7a44c33b206c6b78118154bbb9bc8eb";
const S02_I04_FRONTEND_BASE = "4b28e6b499c4593b7d962fe1ed867c2137d43bc7";
const S02_I04_BACKEND = "e2bfce86afece6772eaf7c2f1eb18e2dd2240f1b";
const S02_I04_OPENAPI =
  "BE60CC2A4612F77AB333088D264B9501B9AB842995AEC1539DA89EA0E8462B47";
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

describe("AIEOS360-S04-I03-E2E pin and architecture consistency", () => {
  it("pins I03 Architecture/Frontend/Backend/OpenAPI/Alembic exactly", () => {
    const constants = read("scripts/aieos360-s04-i03-e2e/constants.mjs");
    expect(constants).toContain(I03_ARCHITECTURE);
    expect(constants).toContain(I03_FRONTEND_BASE);
    expect(constants).toContain(I03_BACKEND);
    expect(constants).toContain(I03_OPENAPI);
    expect(constants).toContain(I03_ALEMBIC);

    const harness = read(
      "e2e-aieos360-s04-i03/support/aieos360S04I03Harness.ts",
    );
    expect(harness).toContain(`"${I03_ARCHITECTURE}"`);
    expect(harness).toContain(`"${I03_FRONTEND_BASE}"`);
    expect(harness).toContain(`"${I03_BACKEND}"`);
    expect(harness).toContain(`"${I03_OPENAPI}"`);
    expect(harness).toContain(`"${I03_ALEMBIC}"`);

    const seed = read("scripts/aieos360-s04-i03-e2e/seed_precondition.py");
    expect(seed).toContain(`BACKEND_PIN_SHA = "${I03_BACKEND}"`);
    expect(seed).toContain(`EXPECTED_MIGRATION_HEAD = "${I03_ALEMBIC}"`);
    expect(seed).toContain("DevelopmentCoherentSchoolContextProvider");
    expect(seed).toContain('"harness_parent_learner_mapping": None');
    expect(seed).toContain('"harness_teacher_authority_map": None');
    expect(seed).toContain('"harness_student_membership_map": None');
    expect(seed).toContain('"harness_principal_scope_map": None');

    const bootstrap = read(
      "scripts/aieos360-s04-i03-e2e/bootstrap_database.py",
    );
    expect(bootstrap).toContain(I03_ALEMBIC);
  });

  it("composes DevelopmentCoherentSchoolContextProvider defaults on all four role surfaces", () => {
    for (const role of ["teacher", "student", "principal", "parent"] as const) {
      const serve = read(`scripts/aieos360-s04-i03-e2e/serve_${role}_app.py`);
      expect(serve).toContain("DevelopmentCoherentSchoolContextProvider");
      expect(serve).toContain("DevelopmentCoherentSchoolContextProvider()");
      expect(serve).not.toContain("set_teacher_class_authority");
      expect(serve).not.toContain("set_learner_membership");
      expect(serve).not.toContain("set_principal_class_scope");
      expect(serve).not.toContain("set_adult_learner_access");
      expect(serve).not.toContain("I04Harness");
      expect(serve).not.toContain("access={PARENT_OS_HUMAN_ADULT_A_ID");
      expect(serve).not.toContain("PrincipalKind.ADMIN");
      expect(serve).not.toContain("admin.");
    }

    const teacher = read("scripts/aieos360-s04-i03-e2e/serve_teacher_app.py");
    expect(teacher).toContain("school_context_class_reader=school_context");
    expect(teacher).not.toContain("DevelopmentSchoolContextClassReader");

    const student = read("scripts/aieos360-s04-i03-e2e/serve_student_app.py");
    expect(student).toContain("learner_membership_reader=membership");
    expect(student).not.toContain("development_learner_membership_reader");
    expect(student).not.toContain("school_context_class_reader=");

    const principal = read(
      "scripts/aieos360-s04-i03-e2e/serve_principal_app.py",
    );
    expect(principal).toContain(
      "school_context_principal_scope_reader=principal_scope",
    );
    expect(principal).not.toContain("school_context_class_reader=");
    expect(principal).not.toContain("learner_membership_reader=");

    const parent = read("scripts/aieos360-s04-i03-e2e/serve_parent_app.py");
    expect(parent).toContain(
      "school_context_parent_learner_access_reader=school_context",
    );
    expect(parent).not.toContain(
      "DevelopmentSchoolContextParentLearnerAccessReader",
    );
  });

  it("does not let browsers supply role/capability/membership/scope/parent access", () => {
    const spec = read(
      "e2e-aieos360-s04-i03/integrated-cross-role.product.spec.ts",
    );
    expect(spec).not.toMatch(/page\.route\s*\(/);
    expect(spec).toContain("assertNoApiMocksInstalled");
    expect(spec).toContain("DevelopmentCoherentSchoolContextProvider");
    expect(spec).toContain("class-5a");
    expect(spec).toContain("This child is not available.");
    expect(spec).toContain("connectStudentBDevSession");
    expect(spec).not.toContain("effective_actor_id");

    const harness = read(
      "e2e-aieos360-s04-i03/support/aieos360S04I03Harness.ts",
    );
    expect(harness).toContain("dev-student-b");
    expect(harness).toContain('input[name="tenantId"]');
    expect(harness).toContain('input[name="bearerToken"]');
    expect(harness).not.toContain('input[name="role"]');
    expect(harness).not.toContain('input[name="classRef"]');
    expect(harness).not.toContain('input[name="capability"]');
    expect(harness).toContain("must not register page.route handlers");
  });

  it("adds an additive I03 Playwright config, package script, and CI lane", () => {
    const pkg = read("package.json");
    expect(pkg).toContain(
      '"test:e2e:aieos360-s04-i03": "playwright test --config playwright.aieos360-s04-i03.config.ts"',
    );

    const config = read("playwright.aieos360-s04-i03.config.ts");
    expect(config).toContain('testDir: "./e2e-aieos360-s04-i03"');
    expect(config).toContain("fullyParallel: false");
    expect(config).toContain("workers: 1");
    expect(config).toContain("8010");
    expect(config).toContain("8011");
    expect(config).toContain("8012");
    expect(config).toContain("8013");
    expect(config).toContain("5281");
    expect(config).toContain("5282");
    expect(config).toContain("5283");
    expect(config).toContain("5284");

    const ci = read(".github/workflows/ci.yml");
    expect(ci).toContain("aieos360-s04-i03-e2e:");
    expect(ci).toContain(`AIEOS_BACKEND_PIN_SHA: ${I03_BACKEND}`);
    expect(ci).toContain(`ref: ${I03_BACKEND}`);
    expect(ci).toContain("pnpm test:e2e:aieos360-s04-i03");
    expect(ci).toContain(I03_OPENAPI);
    expect(ci).toContain(I03_ALEMBIC);

    const i03Job = ci.slice(ci.indexOf("aieos360-s04-i03-e2e:"));
    const nextJob = i03Job.search(/\n {2}[a-z0-9-]+:\n/);
    const i03JobBlock = nextJob === -1 ? i03Job : i03Job.slice(0, nextJob);
    expect(i03JobBlock).toMatch(
      /aieos360-s04-i03-e2e:[\s\S]*?permissions:\s*\n\s{2,}contents:\s*read/,
    );
    expect(i03JobBlock).not.toMatch(/actions:\s*write/);
    expect(i03JobBlock).not.toMatch(/contents:\s*write/);
    expect(i03JobBlock).toContain("postgres:18");
    expect(i03JobBlock).toContain("hashlib.sha256");
    expect(i03JobBlock).toContain("pnpm test:e2e:aieos360-s04-i03");
    expect(i03JobBlock).not.toContain("pnpm test:e2e:aieos360-s03-i04");
    expect(i03JobBlock).not.toContain("pnpm test:e2e:aieos360-s02-i04");
  });

  it("leaves historical S03/S02/S01/Teacher/Student pins unchanged", () => {
    const s03Constants = read("scripts/aieos360-s03-i04-e2e/constants.mjs");
    expect(s03Constants).toContain(S03_I04_BACKEND);
    expect(s03Constants).toContain(S03_I04_FRONTEND_BASE);
    expect(s03Constants).toContain(S03_I04_ARCHITECTURE);
    expect(s03Constants).not.toContain(I03_BACKEND);
    expect(s03Constants).not.toContain(I03_FRONTEND_BASE);

    const s03Pins = read("src/aieos360S03I04E2e.pins.test.ts");
    expect(s03Pins).toContain(S03_I04_BACKEND);
    expect(s03Pins).not.toContain(I03_BACKEND);

    const s02Constants = read("scripts/aieos360-s02-i04-e2e/constants.mjs");
    expect(s02Constants).toContain(S02_I04_BACKEND);
    expect(s02Constants).toContain(S02_I04_OPENAPI);
    expect(s02Constants).toContain(S02_I04_FRONTEND_BASE);
    expect(s02Constants).not.toContain(I03_BACKEND);

    const i05Constants = read("scripts/aieos360-i05-e2e/constants.mjs");
    expect(i05Constants).toContain(I05_BACKEND);
    expect(i05Constants).toContain(I05_OPENAPI);
    expect(i05Constants).toContain(I05_FRONTEND_BASE);
    expect(i05Constants).not.toContain(I03_BACKEND);

    const teacherConstants = read("scripts/product-e2e/constants.mjs");
    expect(teacherConstants).toContain(TEACHER_PRODUCT_BACKEND);
    expect(teacherConstants).not.toContain(I03_BACKEND);

    const studentConstants = read("scripts/student-product-e2e/constants.mjs");
    expect(studentConstants).toContain(STUDENT_PRODUCT_BACKEND);
    expect(studentConstants).not.toContain(I03_BACKEND);

    const ci = read(".github/workflows/ci.yml");
    expect(ci).toContain("aieos360-s03-i04-e2e");
    expect(ci).toContain("aieos360-s02-i04-e2e");
    expect(ci).toContain("aieos360-s01-i05-e2e");
    expect(ci).toContain(`AIEOS_BACKEND_PIN_SHA: ${S03_I04_BACKEND}`);
    expect(ci).toContain(`AIEOS_BACKEND_PIN_SHA: ${S02_I04_BACKEND}`);
    expect(ci).toContain(`AIEOS_BACKEND_PIN_SHA: ${I05_BACKEND}`);
    expect(ci).toContain("pnpm test:e2e:aieos360-s03-i04");
    expect(ci).toContain("pnpm test:e2e:aieos360-s02-i04");
    expect(ci).toContain("pnpm test:e2e:aieos360-i05");
  });
});
