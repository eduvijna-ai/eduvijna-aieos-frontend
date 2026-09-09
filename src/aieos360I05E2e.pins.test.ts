import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const EXPECTED_BACKEND =
  "3d25bb2d7ae3a6a95affdf075a75f20db48a6959";
const EXPECTED_MIGRATION = "a360s010004";
const EXPECTED_OPENAPI =
  "7B51CE21725651B8D556B9DD6D264473DF0A2E7CAF30D722E1CC776C651FAFBB";
const EXPECTED_FRONTEND_BASE =
  "fb5c0f9ae4cb45c8d7876662abdd2e852e318c56";
const TEACHER_BACKEND =
  "a6a1cbb5a83fc9feec6a6f5077fcc5e60f60ab24";
const STUDENT_BACKEND =
  "921d35eb08890a4e1d86cf95daf9d38cdfc4a13c";

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("AIEOS360-S01-I05-E2E pin consistency", () => {
  it("keeps I05 pins additive and historical product lanes intact", () => {
    const constants = read("scripts/aieos360-i05-e2e/constants.mjs");
    expect(constants).toContain(EXPECTED_BACKEND);
    expect(constants).toContain(EXPECTED_MIGRATION);
    expect(constants).toContain(EXPECTED_OPENAPI);
    expect(constants).toContain(EXPECTED_FRONTEND_BASE);

    const harness = read(
      "e2e-aieos360-i05/support/aieos360I05Harness.ts",
    );
    expect(harness).toContain(`"${EXPECTED_BACKEND}"`);
    expect(harness).toContain(`"${EXPECTED_MIGRATION}"`);
    expect(harness).toContain(`"${EXPECTED_OPENAPI}"`);
    expect(harness).toContain(`"${EXPECTED_FRONTEND_BASE}"`);

    const seed = read("scripts/aieos360-i05-e2e/seed_precondition.py");
    expect(seed).toContain(`BACKEND_PIN_SHA = "${EXPECTED_BACKEND}"`);
    expect(seed).toContain(
      `EXPECTED_MIGRATION_HEAD = "${EXPECTED_MIGRATION}"`,
    );
    expect(seed).toContain("ensure_synthetic_student_principals");
    expect(seed).toContain("build_development_teacher_os_app");
    expect(seed).toContain("deterministic_i05_worksheet_model");

    const bootstrap = read(
      "scripts/aieos360-i05-e2e/bootstrap_database.py",
    );
    expect(bootstrap).toContain(EXPECTED_MIGRATION);

    const teacherServe = read(
      "scripts/aieos360-i05-e2e/serve_teacher_app.py",
    );
    expect(teacherServe).toContain("build_development_teacher_os_app");

    const studentServe = read(
      "scripts/aieos360-i05-e2e/serve_student_app.py",
    );
    expect(studentServe).toContain("DevelopmentStudentPrincipalAuthenticator");
    expect(studentServe).toContain("learner_membership_reader");
    expect(studentServe).not.toContain("school_context_class_reader=");
    expect(studentServe).toContain(
      "Intentionally omit school_context_class_reader",
    );

    const ci = read(".github/workflows/ci.yml");
    expect(ci).toContain("aieos360-s01-i05-e2e");
    expect(ci).toContain(`AIEOS_BACKEND_PIN_SHA: ${EXPECTED_BACKEND}`);
    expect(ci).toContain(`ref: ${EXPECTED_BACKEND}`);
    expect(ci).toContain("pnpm test:e2e:aieos360-i05");
    expect(ci).toContain(`AIEOS_BACKEND_PIN_SHA: ${TEACHER_BACKEND}`);
    expect(ci).toContain(`ref: ${TEACHER_BACKEND}`);
    expect(ci).toContain(`AIEOS_BACKEND_PIN_SHA: ${STUDENT_BACKEND}`);
    expect(ci).toContain(`ref: ${STUDENT_BACKEND}`);
    expect(ci).toContain("pnpm test:e2e:product");
    expect(ci).toContain("pnpm test:e2e:student-product");

    const i05Job = ci.slice(ci.indexOf("aieos360-s01-i05-e2e:"));
    const nextJob = i05Job.search(/\n {2}[a-z0-9-]+:\n/);
    const i05JobBlock =
      nextJob === -1 ? i05Job : i05Job.slice(0, nextJob);
    expect(i05JobBlock).toMatch(
      /aieos360-s01-i05-e2e:[\s\S]*?permissions:\s*\n\s{2,}contents:\s*read/,
    );
    expect(i05JobBlock).not.toMatch(/actions:\s*write/);
    expect(i05JobBlock).not.toMatch(/checks:\s*write/);
    expect(i05JobBlock).not.toMatch(/contents:\s*write/);
    expect(i05JobBlock).not.toMatch(/pull-requests:\s*write/);
    expect(i05JobBlock).not.toMatch(/packages:\s*write/);
    expect(i05JobBlock).not.toMatch(/id-token:\s*write/);
    expect(i05JobBlock).not.toMatch(/security-events:\s*write/);

    const teacherConstants = read("scripts/product-e2e/constants.mjs");
    expect(teacherConstants).toContain(TEACHER_BACKEND);
    expect(teacherConstants).not.toContain(EXPECTED_BACKEND);

    const studentConstants = read("scripts/student-product-e2e/constants.mjs");
    expect(studentConstants).toContain(STUDENT_BACKEND);
    expect(studentConstants).not.toContain(EXPECTED_BACKEND);

    const readme = read("docs/aieos360-i05-e2e/README.md");
    expect(readme).toContain(EXPECTED_BACKEND);
    expect(readme).toContain(EXPECTED_MIGRATION);
    expect(readme).toContain(EXPECTED_OPENAPI);
    expect(readme).toContain(TEACHER_BACKEND);
    expect(readme).toContain(STUDENT_BACKEND);
  });
});
