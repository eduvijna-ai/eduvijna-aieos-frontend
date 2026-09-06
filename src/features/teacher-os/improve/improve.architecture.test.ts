import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("TOS-DEV09-I03 Improve architecture / contract", () => {
  it("pins Backend OpenAPI consumer authority", () => {
    const sync = read("scripts/sync-openapi-snapshot.mjs");
    expect(sync).toContain("070e479f405f6246a43f1b0fac0aaf5cdd4a1ac0");
    const digest = createHash("sha256")
      .update(readFileSync(path.join(repoRoot, "contracts/openapi/aieos-v1.consumer-snapshot.json")))
      .digest("hex")
      .toUpperCase();
    expect(digest).toBe(
      "ECA7264BAD37D235967D6E4895749777D7D4F9B19FB0D79D79726430D8C57DFB",
    );
  });

  it("generated contract contains remediation create operation", () => {
    const generated = read("src/services/api/generated/aieos-v1.ts");
    expect(generated).toContain("teaching_work_from_classroom_assessment_create");
    expect(generated).toContain("/api/v1/teaching/works/from-classroom-assessment");
  });

  it("ImprovePage does not invoke generation APIs", () => {
    const page = read("src/features/teacher-os/improve/ImprovePage.tsx");
    expect(page).not.toContain("generateTeachingWork");
    expect(page).not.toContain("prepareTeachingWork");
    expect(page).not.toContain("/actions/generate");
    expect(page).not.toContain("/actions/prepare");
    expect(page).not.toContain("/actions/publish");
    expect(page).not.toContain("createTeachingAssignment");
    expect(page).toContain("createRemediationTeachingWorkFromAssessment");
    expect(page).not.toMatch(/\/improvements/);
    expect(page).not.toMatch(/learner|mastery|AI recommend/i);
    expect(page).not.toContain("teacherMemory");
    expect(page).not.toContain("/teacher-os/memory");
  });

  it("API client posts only the dedicated remediation endpoint", () => {
    const api = read("src/services/api/teachingWorkApi.ts");
    expect(api).toContain(
      '"/api/v1/teaching/works/from-classroom-assessment"',
    );
    expect(api).toContain("createRemediationTeachingWorkFromAssessment");
    expect(api).not.toMatch(/\/api\/v1\/improvements/);
  });
});
