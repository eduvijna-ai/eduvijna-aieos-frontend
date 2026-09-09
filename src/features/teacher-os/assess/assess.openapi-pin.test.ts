import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

const EXPECTED_OPENAPI_SHA =
  "7B51CE21725651B8D556B9DD6D264473DF0A2E7CAF30D722E1CC776C651FAFBB";
const EXPECTED_BACKEND_SOURCE_SHA =
  "3d25bb2d7ae3a6a95affdf075a75f20db48a6959";

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("AIEOS360-S01-I05-F1 OpenAPI consumer pin", () => {
  it("consumer snapshot matches Backend B3R1 OpenAPI SHA", () => {
    const digest = createHash("sha256")
      .update(
        readFileSync(
          path.join(repoRoot, "contracts/openapi/aieos-v1.consumer-snapshot.json"),
        ),
      )
      .digest("hex")
      .toUpperCase();
    expect(digest).toBe(EXPECTED_OPENAPI_SHA);
  });

  it("sync script pins exact Backend merge SHA", () => {
    const script = read("scripts/sync-openapi-snapshot.mjs");
    expect(script).toContain(EXPECTED_BACKEND_SOURCE_SHA);
    expect(script).toContain(EXPECTED_OPENAPI_SHA);
  });

  it("generated types include intelligence and ensure-evaluations operations", () => {
    const generated = read("src/services/api/generated/aieos-v1.ts");
    expect(generated).toContain("assessment_assignment_intelligence");
    expect(generated).toContain("assessment_assignment_evaluations_ensure");
    expect(generated).toContain("TeacherAssessmentIntelligenceResponse");
  });
});
