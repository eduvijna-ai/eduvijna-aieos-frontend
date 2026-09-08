import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const EXPECTED_BACKEND =
  "921d35eb08890a4e1d86cf95daf9d38cdfc4a13c";
const EXPECTED_MIGRATION = "a360s010002";
const EXPECTED_OPENAPI =
  "4691D6BADA2157D436435BB5CCDD6797EA670D1A87543D42CA39A478F940F330";
const TEACHER_BACKEND =
  "a6a1cbb5a83fc9feec6a6f5077fcc5e60f60ab24";

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("AIEOS360-S01-I04R1 student-product-E2E pin consistency", () => {
  it("keeps Student pins additive and Teacher product-e2e pin intact", () => {
    const constants = read("scripts/student-product-e2e/constants.mjs");
    expect(constants).toContain(EXPECTED_BACKEND);
    expect(constants).toContain(EXPECTED_MIGRATION);
    expect(constants).toContain(EXPECTED_OPENAPI);

    const harness = read(
      "e2e-student-product/support/studentProductHarness.ts",
    );
    expect(harness).toContain(`"${EXPECTED_BACKEND}"`);
    expect(harness).toContain(`"${EXPECTED_MIGRATION}"`);
    expect(harness).toContain(`"${EXPECTED_OPENAPI}"`);

    const seed = read("scripts/student-product-e2e/seed_precondition.py");
    expect(seed).toContain(`BACKEND_PIN_SHA = "${EXPECTED_BACKEND}"`);
    expect(seed).toContain(
      `EXPECTED_MIGRATION_HEAD = "${EXPECTED_MIGRATION}"`,
    );
    expect(seed).toContain("ensure_synthetic_student_principals");
    expect(seed).toContain("seed_published_learner_content");
    expect(seed).toContain("create_learner_assignment");

    const bootstrap = read(
      "scripts/student-product-e2e/bootstrap_database.py",
    );
    expect(bootstrap).toContain(EXPECTED_MIGRATION);

    const serve = read(
      "scripts/student-product-e2e/serve_development_app.py",
    );
    expect(serve).toContain("DevelopmentStudentPrincipalAuthenticator");
    expect(serve).toContain("learner_membership_reader");
    expect(serve).toContain("FileGatedLearnerMembershipReader");

    const ci = read(".github/workflows/ci.yml");
    expect(ci).toContain("student-product-e2e");
    expect(ci).toContain(`AIEOS_BACKEND_PIN_SHA: ${EXPECTED_BACKEND}`);
    expect(ci).toContain(`ref: ${EXPECTED_BACKEND}`);
    expect(ci).toContain(`AIEOS_BACKEND_PIN_SHA: ${TEACHER_BACKEND}`);
    expect(ci).toContain(`ref: ${TEACHER_BACKEND}`);
    expect(ci).toContain("pnpm test:e2e:student-product");
    expect(ci).toContain("pnpm test:e2e:product");

    const teacherConstants = read("scripts/product-e2e/constants.mjs");
    expect(teacherConstants).toContain(TEACHER_BACKEND);
    expect(teacherConstants).not.toContain(EXPECTED_BACKEND);

    const readme = read("docs/student-product-e2e/README.md");
    expect(readme).toContain(EXPECTED_BACKEND);
    expect(readme).toContain(EXPECTED_MIGRATION);
    expect(readme).toContain(EXPECTED_OPENAPI);
    expect(readme).toContain(TEACHER_BACKEND);
  });
});
