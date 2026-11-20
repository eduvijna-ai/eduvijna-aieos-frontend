import { describe, expect, it } from "vitest";
import {
  hintTextScalarCount,
  verifyLearnerHintForQuestion,
} from "./learnerHintPolicy";
import {
  ATTEMPT_ID,
  CONTENT_VERSION_ID,
} from "../studentOs.fixtures";

/** Retired 32-bit DJB2 fingerprint — documented collision only; not used for boundaries. */
function legacyBearerFingerprint(token: string): number {
  let fingerprint = 5381;
  for (let i = 0; i < token.length; i++) {
    fingerprint =
      ((fingerprint << 5) + fingerprint) ^ token.charCodeAt(i);
  }
  return fingerprint;
}

const COLLISION_TOKEN_A = "test-session-0000v";
const COLLISION_TOKEN_B = "test-session-00060";

describe("hint text scalar contract", () => {
  it("counts Unicode scalars, not UTF-16 code units", () => {
    const fiveHundred = "😀".repeat(500);
    expect(hintTextScalarCount(fiveHundred)).toBe(500);
    const fiveHundredOne = "😀".repeat(501);
    expect(hintTextScalarCount(fiveHundredOne)).toBe(501);
  });

  it("accepts 500 non-BMP scalars and rejects 501 in verification", () => {
    const body500 = {
      attempt_id: ATTEMPT_ID,
      content_version_id: CONTENT_VERSION_ID,
      hints: [{ question_id: "q-tf", hint_text: "😀".repeat(500) }],
    };
    expect(
      verifyLearnerHintForQuestion(body500, {
        attemptId: ATTEMPT_ID,
        contentVersionId: CONTENT_VERSION_ID,
        questionId: "q-tf",
        questionIds: ["q-tf"],
      }).kind,
    ).toBe("hint");

    const body501 = {
      ...body500,
      hints: [{ question_id: "q-tf", hint_text: "😀".repeat(501) }],
    };
    expect(
      verifyLearnerHintForQuestion(body501, {
        attemptId: ATTEMPT_ID,
        contentVersionId: CONTENT_VERSION_ID,
        questionId: "q-tf",
        questionIds: ["q-tf"],
      }).kind,
    ).toBe("invalid");
  });

  it("documents the known 32-bit fingerprint collision pair", () => {
    expect(legacyBearerFingerprint(COLLISION_TOKEN_A)).toBe(
      legacyBearerFingerprint(COLLISION_TOKEN_B),
    );
    expect(COLLISION_TOKEN_A).not.toBe(COLLISION_TOKEN_B);
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