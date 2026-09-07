import { describe, expect, it } from "vitest";
import { artifactPurposeCopy } from "./artifactPurpose";
import { PREPARATION_ARTIFACT_KINDS } from "./preparationKit";

describe("artifactPurposeCopy", () => {
  it("returns presentation copy for every canonical kind", () => {
    expect(artifactPurposeCopy("lesson_plan")).toMatch(/Lesson structure/);
    expect(artifactPurposeCopy("worksheet")).toMatch(/Practice activities/);
    expect(artifactPurposeCopy("quiz")).toMatch(/check for understanding/i);
    expect(artifactPurposeCopy("homework")).toMatch(/Independent practice/);
    expect(artifactPurposeCopy("answer_key")).toMatch(/Answers and explanations/);
    expect(artifactPurposeCopy("teacher_notes")).toMatch(/Teaching cues/);
    expect(PREPARATION_ARTIFACT_KINDS).toHaveLength(6);
  });

  it("does not invent copy for unknown kinds", () => {
    expect(artifactPurposeCopy("custom_note")).toBeNull();
  });
});
