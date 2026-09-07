import { describe, expect, it } from "vitest";
import {
  originPreparedLabel,
  originQueueLabel,
  reviewArtifactTypeLabel,
  reviewPageTitle,
  reviewStatusLabel,
} from "./reviewPresentation";

describe("reviewPresentation", () => {
  it("humanizes dotted and canonical artifact types", () => {
    expect(reviewArtifactTypeLabel("worksheet")).toBe("Worksheet");
    expect(reviewArtifactTypeLabel("lesson.plan")).toBe("Lesson Plan");
    expect(reviewArtifactTypeLabel("quiz")).toBe("Quick Quiz");
  });

  it("humanizes status and origin", () => {
    expect(reviewStatusLabel("IN_REVIEW")).toBe("In Review");
    expect(reviewStatusLabel("In Review")).toBe("In Review");
    expect(originQueueLabel("AI")).toBe("AI-prepared");
    expect(originQueueLabel("teacher")).toBe("Teacher-prepared");
    expect(originPreparedLabel("AI")).toBe("Prepared by AI");
  });

  it("builds a review page title from the artifact type", () => {
    expect(reviewPageTitle("worksheet")).toBe("Review Worksheet");
  });
});
