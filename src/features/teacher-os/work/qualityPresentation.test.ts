import { describe, expect, it } from "vitest";
import {
  humanizeSnakeCase,
  isEducationalQualityPass,
  qualityCheckLabel,
  qualitySummaryText,
} from "./qualityPresentation";
import type { EducationalQuality } from "@/services/api/generated/teachingTypes";

describe("qualityPresentation", () => {
  it("maps known educational quality codes to teacher labels", () => {
    expect(qualityCheckLabel("schema_valid")).toBe("Content structure valid");
    expect(qualityCheckLabel("shared_objectives_present")).toBe(
      "Learning objectives aligned",
    );
    expect(qualityCheckLabel("lesson_plan_objectives_mapped")).toBe(
      "Lesson activities aligned",
    );
    expect(qualityCheckLabel("worksheet_objectives_mapped")).toBe(
      "Worksheet aligned to objectives",
    );
    expect(qualityCheckLabel("quiz_objectives_mapped")).toBe(
      "Quiz aligned to objectives",
    );
    expect(qualityCheckLabel("homework_objectives_mapped")).toBe(
      "Homework aligned to objectives",
    );
  });

  it("humanizes unknown snake_case codes without exposing the raw token as the label", () => {
    expect(qualityCheckLabel("student_support_alignment")).toBe(
      "Student support alignment",
    );
    expect(humanizeSnakeCase("student_support_alignment")).not.toBe(
      "student_support_alignment",
    );
  });

  it("does not claim pass unless backend status is PASS", () => {
    const failed: EducationalQuality = {
      status: "FAIL",
      checks: [
        { code: "schema_valid", passed: true, explanation: "ok" },
        { code: "shared_objectives_present", passed: false, explanation: "no" },
      ],
    };
    expect(isEducationalQualityPass(failed)).toBe(false);
    expect(qualitySummaryText(failed)).toBe("1 of 2 quality checks passed");
    expect(qualitySummaryText(failed)).not.toMatch(/✓/);
  });

  it("summarizes a backend PASS with the check count", () => {
    const passed: EducationalQuality = {
      status: "PASS",
      checks: [
        { code: "schema_valid", passed: true, explanation: "ok" },
        { code: "age_appropriate", passed: true, explanation: "ok" },
      ],
    };
    expect(qualitySummaryText(passed)).toBe("✓ 2 quality checks passed");
  });
});
