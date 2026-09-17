import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const I03_BACKEND = "e2bfce86afece6772eaf7c2f1eb18e2dd2240f1b";
const I03_OPENAPI =
  "BE60CC2A4612F77AB333088D264B9501B9AB842995AEC1539DA89EA0E8462B47";
const I05_E2E_BACKEND = "3d25bb2d7ae3a6a95affdf075a75f20db48a6959";
const I05_E2E_OPENAPI =
  "7B51CE21725651B8D556B9DD6D264473DF0A2E7CAF30D722E1CC776C651FAFBB";
const TEACHER_PRODUCT_BACKEND =
  "a6a1cbb5a83fc9feec6a6f5077fcc5e60f60ab24";
const STUDENT_PRODUCT_BACKEND =
  "921d35eb08890a4e1d86cf95daf9d38cdfc4a13c";

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("AIEOS360-S02-I03 Principal OS consumer contract pin", () => {
  it("documents the S02-I03 Backend OpenAPI as a previous consumer pin", () => {
    const sync = read("scripts/sync-openapi-snapshot.mjs");
    expect(sync).toContain(I03_BACKEND);
    expect(sync).toContain(I03_OPENAPI);
    expect(sync).not.toContain(`const PINNED_SHA = "${I03_BACKEND}"`);

    const readme = read("contracts/openapi/README.md");
    expect(readme).toContain(I03_BACKEND);
    expect(readme).toContain(I03_OPENAPI);
  });

  it("generated types include Principal School Intelligence GET only", () => {
    const generated = read("src/services/api/generated/aieos-v1.ts");
    const snapshot = read("contracts/openapi/aieos-v1.consumer-snapshot.json");
    expect(generated).toContain("PrincipalSchoolIntelligenceResponse");
    expect(generated).toContain("PrincipalSchoolIntelligenceSummaryResponse");
    expect(generated).toContain("PrincipalSchoolIntelligenceClassCardResponse");
    expect(generated).toContain("AssignmentLifecycleResponse");
    expect(generated).toContain("EvaluationCoverageAmongSubmittedResponse");
    expect(generated).toContain("principal_os_school_intelligence_get");
    expect(generated).toContain('"/api/v1/principal-os/school-intelligence"');
    expect(snapshot).toContain(
      '"operationId": "principal_os_school_intelligence_get"',
    );
    expect(snapshot).toContain("/api/v1/principal-os/school-intelligence");

    const pathStart = generated.indexOf(
      '"/api/v1/principal-os/school-intelligence"',
    );
    const nextPath = generated.indexOf('"/api/v1/', pathStart + 1);
    const principalPath = generated.slice(pathStart, nextPath);
    expect(principalPath).toContain(
      'get: operations["principal_os_school_intelligence_get"]',
    );
    expect(principalPath).toContain("post?: never");
    expect(principalPath).toContain("put?: never");
    expect(principalPath).toContain("patch?: never");
    expect(principalPath).toContain("delete?: never");
    expect(principalPath).not.toContain("post: operations");
    expect(snapshot).not.toMatch(
      /\/api\/v1\/principal-os\/[^"]+"[\s\S]{0,800}"post"\s*:\s*\{/,
    );
  });

  it("leaves historical S01/Teacher/Student E2E pins unchanged", () => {
    const i05 = read("src/aieos360I05E2e.pins.test.ts");
    expect(i05).toContain(I05_E2E_BACKEND);
    expect(i05).toContain(I05_E2E_OPENAPI);
    expect(i05).not.toContain(I03_BACKEND);
    expect(i05).not.toContain(I03_OPENAPI);

    const teacher = read("src/productE2e.pins.test.ts");
    expect(teacher).toContain(TEACHER_PRODUCT_BACKEND);
    expect(teacher).not.toContain(I03_BACKEND);

    const student = read("src/studentProductE2e.pins.test.ts");
    expect(student).toContain(STUDENT_PRODUCT_BACKEND);
    expect(student).not.toContain(I03_BACKEND);

    const i05Constants = read("scripts/aieos360-i05-e2e/constants.mjs");
    expect(i05Constants).toContain(I05_E2E_BACKEND);
    expect(i05Constants).toContain(I05_E2E_OPENAPI);
    expect(i05Constants).not.toContain(I03_BACKEND);

    const teacherConstants = read("scripts/product-e2e/constants.mjs");
    expect(teacherConstants).toContain(TEACHER_PRODUCT_BACKEND);
    expect(teacherConstants).not.toContain(I03_BACKEND);

    const studentConstants = read("scripts/student-product-e2e/constants.mjs");
    expect(studentConstants).toContain(STUDENT_PRODUCT_BACKEND);
    expect(studentConstants).not.toContain(I03_BACKEND);
  });
});
