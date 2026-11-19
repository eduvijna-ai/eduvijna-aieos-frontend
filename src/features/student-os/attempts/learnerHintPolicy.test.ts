import { describe, expect, it } from "vitest";
import {
  devSessionPrivacyBoundaryKey,
  verifyLearnerHintForQuestion,
} from "./learnerHintPolicy";
import {
  ATTEMPT_ID,
  CONTENT_VERSION_ID,
} from "../studentOs.fixtures";

describe("devSessionPrivacyBoundaryKey", () => {
  it("changes when bearer token changes within the same tenant", () => {
    const base = {
      apiOrigin: "http://127.0.0.1:8080",
      tenantId: "tenant-a",
      bearerToken: "token-a",
    };
    const other = { ...base, bearerToken: "token-b" };
    expect(devSessionPrivacyBoundaryKey(base)).not.toBe(
      devSessionPrivacyBoundaryKey(other),
    );
  });
});

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

  it("rejects malformed roots, hint arrays, and hint items", () => {
    expect(
      verifyLearnerHintForQuestion(null, {
        attemptId: ATTEMPT_ID,
        contentVersionId: CONTENT_VERSION_ID,
        questionId: "q-tf",
        questionIds,
      }).kind,
    ).toBe("invalid");

    expect(
      verifyLearnerHintForQuestion(
        {
          attempt_id: ATTEMPT_ID,
          content_version_id: CONTENT_VERSION_ID,
          hints: "not-array",
        },
        {
          attemptId: ATTEMPT_ID,
          contentVersionId: CONTENT_VERSION_ID,
          questionId: "q-tf",
          questionIds,
        },
      ).kind,
    ).toBe("invalid");

    expect(
      verifyLearnerHintForQuestion(
        {
          attempt_id: ATTEMPT_ID,
          content_version_id: CONTENT_VERSION_ID,
          hints: [{ question_id: "q-tf", hint_text: 42 }],
        },
        {
          attemptId: ATTEMPT_ID,
          contentVersionId: CONTENT_VERSION_ID,
          questionId: "q-tf",
          questionIds,
        },
      ).kind,
    ).toBe("invalid");

    expect(
      verifyLearnerHintForQuestion(
        {
          attempt_id: ATTEMPT_ID,
          content_version_id: CONTENT_VERSION_ID,
          hints: [
            { question_id: "q-tf", hint_text: "a" },
            { question_id: "q-tf", hint_text: "dup" },
          ],
        },
        {
          attemptId: ATTEMPT_ID,
          contentVersionId: CONTENT_VERSION_ID,
          questionId: "q-tf",
          questionIds,
        },
      ).kind,
    ).toBe("invalid");

    expect(
      verifyLearnerHintForQuestion(
        {
          attempt_id: ATTEMPT_ID,
          content_version_id: CONTENT_VERSION_ID,
          hints: [{ question_id: "q-unknown", hint_text: "sneaky" }],
        },
        {
          attemptId: ATTEMPT_ID,
          contentVersionId: CONTENT_VERSION_ID,
          questionId: "q-tf",
          questionIds,
        },
      ).kind,
    ).toBe("invalid");
  });
});