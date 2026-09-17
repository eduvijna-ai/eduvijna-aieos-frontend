import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

const HISTORICAL_I05_OPENAPI_SHA =
  "7B51CE21725651B8D556B9DD6D264473DF0A2E7CAF30D722E1CC776C651FAFBB";
const HISTORICAL_I05_BACKEND_SOURCE_SHA =
  "3d25bb2d7ae3a6a95affdf075a75f20db48a6959";
const CURRENT_OPENAPI_SHA =
  "4042FB2725DA70A02A70EE09563B7698AE2E5DA82927614CAF1B5F7E6AA7C1D0";

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("AIEOS360-S01-I05-F1 OpenAPI consumer pin", () => {
  it("consumer snapshot matches the current Backend OpenAPI SHA", () => {
    const digest = createHash("sha256")
      .update(
        readFileSync(
          path.join(repoRoot, "contracts/openapi/aieos-v1.consumer-snapshot.json"),
        ),
      )
      .digest("hex")
      .toUpperCase();
    expect(digest).toBe(CURRENT_OPENAPI_SHA);
  });

  it("sync script keeps the I05-F1 pin documented", () => {
    const script = read("scripts/sync-openapi-snapshot.mjs");
    expect(script).toContain(HISTORICAL_I05_BACKEND_SOURCE_SHA);
    expect(script).toContain(HISTORICAL_I05_OPENAPI_SHA);
    expect(script).toContain(CURRENT_OPENAPI_SHA);
  });

  it("generated types include intelligence and ensure-evaluations operations", () => {
    const generated = read("src/services/api/generated/aieos-v1.ts");
    expect(generated).toContain("assessment_assignment_intelligence");
    expect(generated).toContain("assessment_assignment_evaluations_ensure");
    expect(generated).toContain("TeacherAssessmentIntelligenceResponse");
  });
});
