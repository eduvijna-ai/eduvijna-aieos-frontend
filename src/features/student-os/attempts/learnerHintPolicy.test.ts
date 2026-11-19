import { describe, expect, it } from "vitest";
import { verifyLearnerHintForQuestion } from "./learnerHintPolicy";
import {
  ATTEMPT_ID,
  CONTENT_VERSION_ID,
} from "../studentOs.fixtures";

describe("verifyLearnerHintForQuestion", () => {
  const questionIds = ["q-tf", "q-mc"] as const;

  it("returns hint text only for the requested allowlisted question", () => {
    const outcome = verifyLearnerHintForQuestion(
      {
        attempt_id: ATTEMPT_ID,
        content_version_id: CONTENT_VERSION_ID,
        hints: [
          { question_id: "q-tf", hint_text: "Think about veins." },
          { question_id: "q-mc", hint_text: "Leaves make food." },
        ],
      },
      {
        attemptId: ATTEMPT_ID,
        contentVersionId: CONTENT_VERSION_ID,
        questionId: "q-tf",
        questionIds,
      },
    );
    expect(outcome).toEqual({ kind: "hint", text: "Think about veins." });
  });

  it("fails closed on attempt or version mismatch", () => {
    expect(
      verifyLearnerHintForQuestion(
        {
          attempt_id: "00000000-0000-4000-8000-000000000001",
          content_version_id: CONTENT_VERSION_ID,
          hints: [{ question_id: "q-tf", hint_text: "x" }],
        },
        {
          attemptId: ATTEMPT_ID,
          contentVersionId: CONTENT_VERSION_ID,
          questionId: "q-tf",
          questionIds,
        },
      ).kind,
    ).toBe("mismatch");

    expect(
      verifyLearnerHintForQuestion(
        {
          attempt_id: ATTEMPT_ID,
          content_version_id: "00000000-0000-4000-8000-000000000002",
          hints: [{ question_id: "q-tf", hint_text: "x" }],
        },
        {
          attemptId: ATTEMPT_ID,
          contentVersionId: CONTENT_VERSION_ID,
          questionId: "q-tf",
          questionIds,
        },
      ).kind,
    ).toBe("mismatch");
  });

  it("returns empty when the question has no hint in the response list", () => {
    const outcome = verifyLearnerHintForQuestion(
      {
        attempt_id: ATTEMPT_ID,
        content_version_id: CONTENT_VERSION_ID,
        hints: [{ question_id: "q-mc", hint_text: "Other only." }],
      },
      {
        attemptId: ATTEMPT_ID,
        contentVersionId: CONTENT_VERSION_ID,
        questionId: "q-tf",
        questionIds,
      },
    );
    expect(outcome).toEqual({ kind: "empty" });
  });
});