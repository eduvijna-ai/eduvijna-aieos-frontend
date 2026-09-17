import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const I04_ARCHITECTURE = "67f4020b78cacdf1716e18d83f4410cb16fdcb4d";
const I04_FRONTEND_BASE = "04c2b1850732df1b8fe5de55f018edf30365181d";
const I04_BACKEND = "138f37bfa7a44c33b206c6b78118154bbb9bc8eb";
const I04_OPENAPI =
  "4042FB2725DA70A02A70EE09563B7698AE2E5DA82927614CAF1B5F7E6AA7C1D0";
const I04_ALEMBIC = "a360s010004";

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
const I03_FRONTEND_BASE = "1b4263d0668f66d84cc261c79a2e81883375219e";

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("AIEOS360-S03-I04-E2E pin and architecture consistency", () => {
  it("pins I04 Architecture/Frontend/Backend/OpenAPI/Alembic exactly", () => {
    const constants = read("scripts/aieos360-s03-i04-e2e/constants.mjs");
    expect(constants).toContain(I04_ARCHITECTURE);
    expect(constants).toContain(I04_FRONTEND_BASE);
    expect(constants).toContain(I04_BACKEND);
    expect(constants).toContain(I04_OPENAPI);
    expect(constants).toContain(I04_ALEMBIC);
    expect(constants).not.toContain(S02_I04_BACKEND);
    expect(constants).not.toContain(S02_I04_OPENAPI);

    const harness = read(
      "e2e-aieos360-s03-i04/support/aieos360S03I04Harness.ts",
    );
    expect(harness).toContain(`"${I04_ARCHITECTURE}"`);
    expect(harness).toContain(`"${I04_FRONTEND_BASE}"`);
    expect(harness).toContain(`"${I04_BACKEND}"`);
    expect(harness).toContain(`"${I04_OPENAPI}"`);
    expect(harness).toContain(`"${I04_ALEMBIC}"`);

    const seed = read("scripts/aieos360-s03-i04-e2e/seed_precondition.py");
    expect(seed).toContain(`BACKEND_PIN_SHA = "${I04_BACKEND}"`);
    expect(seed).toContain(`EXPECTED_MIGRATION_HEAD = "${I04_ALEMBIC}"`);
    expect(seed).toContain("PARENT_OS_HUMAN_ADULT_A_ID");
    expect(seed).toContain("STUDENT_A_PRINCIPAL_ID");
    expect(seed).toContain("STUDENT_B_PRINCIPAL_ID");
    expect(seed).toContain("seed_tenant");
    expect(seed).toContain("seed_membership");
    expect(seed).toContain("principal_kind=PrincipalKind.HUMAN");
    expect(seed).not.toContain("PrincipalKind.PARENT");

    const bootstrap = read(
      "scripts/aieos360-s03-i04-e2e/bootstrap_database.py",
    );
    expect(bootstrap).toContain(I04_ALEMBIC);
  });

  it("composes harness-local Parent access for Student A only and does not mutate canonical _DEFAULT_ACCESS", () => {
    const parentServe = read(
      "scripts/aieos360-s03-i04-e2e/serve_parent_app.py",
    );
    expect(parentServe).toContain("PARENT_OS_HUMAN_ADULT_A_ID");
    expect(parentServe).toContain("STUDENT_A_PRINCIPAL_ID");
    expect(parentServe).toContain(
      "access={PARENT_OS_HUMAN_ADULT_A_ID: (STUDENT_A_PRINCIPAL_ID,)}",
    );
    expect(parentServe).toContain("DevelopmentPrincipalAuthenticator");
    expect(parentServe).toContain("DevelopmentParentIntelligencePermit");
    expect(parentServe).toContain(
      "DevelopmentSchoolContextParentLearnerAccessReader",
    );
    expect(parentServe).toContain("CurrentPrincipalClassificationAuthority");
    expect(parentServe).toContain("SecurityAuthorityLearnerPrincipalIntegrity");
    expect(parentServe).toContain("CurrentParentLearnerAccessService");
    expect(parentServe).toContain("SqlAlchemyParentIntelligenceFactsReader");
    expect(parentServe).toContain(
      "DevelopmentSchoolContextLearnerMembershipReader",
    );
    expect(parentServe).toContain(
      "parent_learner_access_service=parent_learner_access_service",
    );
    expect(parentServe).toContain(
      "Intentionally omit school_context_class_reader and learner_membership_reader",
    );
    expect(parentServe).not.toContain("school_context_class_reader=");
    expect(parentServe).not.toContain("learner_membership_reader=");
    expect(parentServe).not.toContain("_DEFAULT_ACCESS");
    expect(parentServe).not.toContain("LEARNER_CHILD_1_ID");
    expect(parentServe).not.toContain("LEARNER_CHILD_2_ID");
    expect(parentServe).not.toContain("STUDENT_B_PRINCIPAL_ID");
    expect(parentServe).not.toContain("set_current_authorized_learners");
  });

  it("does not let the Parent browser supply learner/role/capability/school authority", () => {
    const spec = read(
      "e2e-aieos360-s03-i04/parent-os-real-stack.product.spec.ts",
    );
    expect(spec).toContain("connectParentDevSession");
    expect(spec).toContain("PARENT_OS_HOME_PATH");
    expect(spec).toContain("assertParentTransportOnly");
    expect(spec).not.toMatch(/page\.route\s*\(/);
    expect(spec).toContain("assertNoApiMocksInstalled");
    expect(spec).toContain("This child is not available.");
    expect(spec).toContain("attempt_status).toBe(\"SUBMITTED\")");
    expect(spec).not.toContain("effective_actor_id");

    const harness = read(
      "e2e-aieos360-s03-i04/support/aieos360S03I04Harness.ts",
    );
    expect(harness).toContain("input[name=\"tenantId\"]");
    expect(harness).toContain("input[name=\"bearerToken\"]");
    expect(harness).not.toContain("input[name=\"role\"]");
    expect(harness).not.toContain("input[name=\"classRef\"]");
    expect(harness).not.toContain("input[name=\"capability\"]");
    expect(harness).toContain("must not register page.route handlers");
    expect(harness).toContain("aieos360-s03-i04-e2e-parent");
  });

  it("adds an additive I04 Playwright config, package script, and CI lane", () => {
    const pkg = read("package.json");
    expect(pkg).toContain(
      '"test:e2e:aieos360-s03-i04": "playwright test --config playwright.aieos360-s03-i04.config.ts"',
    );
    expect(pkg).toContain(
      '"test:e2e:aieos360-s02-i04": "playwright test --config playwright.aieos360-s02-i04.config.ts"',
    );

    const config = read("playwright.aieos360-s03-i04.config.ts");
    expect(config).toContain('testDir: "./e2e-aieos360-s03-i04"');
    expect(config).toContain("fullyParallel: false");
    expect(config).toContain("workers: 1");
    expect(config).toContain("retries: 0");
    expect(config).toContain("start-parent-backend.mjs");
    expect(config).toContain("5188");
    expect(config).toContain("5189");
    expect(config).toContain("5190");
    expect(config).toContain("8007");
    expect(config).toContain("8008");
    expect(config).toContain("8009");

    const ci = read(".github/workflows/ci.yml");
    expect(ci).toContain("aieos360-s03-i04-e2e:");
    expect(ci).toContain(`AIEOS_BACKEND_PIN_SHA: ${I04_BACKEND}`);
    expect(ci).toContain(`ref: ${I04_BACKEND}`);
    expect(ci).toContain("pnpm test:e2e:aieos360-s03-i04");
    expect(ci).toContain("sha256(");
    expect(ci).toContain(I04_OPENAPI);
    expect(ci).toContain(I04_ALEMBIC);

    const i04Job = ci.slice(ci.indexOf("aieos360-s03-i04-e2e:"));
    const nextJob = i04Job.search(/\n {2}[a-z0-9-]+:\n/);
    const i04JobBlock = nextJob === -1 ? i04Job : i04Job.slice(0, nextJob);
    expect(i04JobBlock).toMatch(
      /aieos360-s03-i04-e2e:[\s\S]*?permissions:\s*\n\s{2,}contents:\s*read/,
    );
    expect(i04JobBlock).not.toMatch(/actions:\s*write/);
    expect(i04JobBlock).not.toMatch(/contents:\s*write/);
    expect(i04JobBlock).toContain("postgres:18");
    expect(i04JobBlock).toContain("hashlib.sha256");
    expect(i04JobBlock).toContain("pnpm test:e2e:aieos360-s03-i04");
    expect(i04JobBlock).not.toContain("pnpm test:e2e:aieos360-s02-i04");
    expect(i04JobBlock).not.toContain("pnpm test:e2e:aieos360-i05");
  });

  it("leaves historical S02/S01/Teacher/Student/I03 pins unchanged", () => {
    const s02Constants = read("scripts/aieos360-s02-i04-e2e/constants.mjs");
    expect(s02Constants).toContain(S02_I04_BACKEND);
    expect(s02Constants).toContain(S02_I04_OPENAPI);
    expect(s02Constants).toContain(S02_I04_FRONTEND_BASE);
    expect(s02Constants).not.toContain(I04_BACKEND);
    expect(s02Constants).not.toContain(I04_OPENAPI);
    expect(s02Constants).not.toContain(I04_FRONTEND_BASE);

    const s02Pins = read("src/aieos360S02I04E2e.pins.test.ts");
    expect(s02Pins).toContain(S02_I04_BACKEND);
    expect(s02Pins).toContain(S02_I04_OPENAPI);
    expect(s02Pins).toContain(S02_I04_FRONTEND_BASE);
    expect(s02Pins).not.toContain(I04_BACKEND);

    const i05Constants = read("scripts/aieos360-i05-e2e/constants.mjs");
    expect(i05Constants).toContain(I05_BACKEND);
    expect(i05Constants).toContain(I05_OPENAPI);
    expect(i05Constants).toContain(I05_FRONTEND_BASE);
    expect(i05Constants).not.toContain(I04_BACKEND);
    expect(i05Constants).not.toContain(I04_OPENAPI);

    const i05Pins = read("src/aieos360I05E2e.pins.test.ts");
    expect(i05Pins).toContain(I05_BACKEND);
    expect(i05Pins).not.toContain(I04_BACKEND);

    const teacherConstants = read("scripts/product-e2e/constants.mjs");
    expect(teacherConstants).toContain(TEACHER_PRODUCT_BACKEND);
    expect(teacherConstants).not.toContain(I04_BACKEND);

    const studentConstants = read("scripts/student-product-e2e/constants.mjs");
    expect(studentConstants).toContain(STUDENT_PRODUCT_BACKEND);
    expect(studentConstants).not.toContain(I04_BACKEND);

    const i03Pins = read("src/aieos360S03I03.pins.test.ts");
    expect(i03Pins).toContain(I04_BACKEND);
    expect(i03Pins).toContain(I04_OPENAPI);
    expect(i03Pins).toContain(I03_FRONTEND_BASE);
    expect(i03Pins).toContain(I04_ARCHITECTURE);
    expect(i03Pins).not.toContain(I04_FRONTEND_BASE);

    const ci = read(".github/workflows/ci.yml");
    expect(ci).toContain("aieos360-s02-i04-e2e");
    expect(ci).toContain("aieos360-s01-i05-e2e");
    expect(ci).toContain(`AIEOS_BACKEND_PIN_SHA: ${S02_I04_BACKEND}`);
    expect(ci).toContain(`ref: ${S02_I04_BACKEND}`);
    expect(ci).toContain(`AIEOS_BACKEND_PIN_SHA: ${I05_BACKEND}`);
    expect(ci).toContain(`ref: ${I05_BACKEND}`);
    expect(ci).toContain(`AIEOS_BACKEND_PIN_SHA: ${TEACHER_PRODUCT_BACKEND}`);
    expect(ci).toContain(`AIEOS_BACKEND_PIN_SHA: ${STUDENT_PRODUCT_BACKEND}`);
    expect(ci).toContain("pnpm test:e2e:aieos360-s02-i04");
    expect(ci).toContain("pnpm test:e2e:aieos360-i05");
    expect(ci).toContain("pnpm test:e2e:product");
    expect(ci).toContain("pnpm test:e2e:student-product");

    const sync = read("scripts/sync-openapi-snapshot.mjs");
    expect(sync).toContain(`const PINNED_SHA = "${I04_BACKEND}"`);
  });
});
