import { describe, expect, it } from "vitest";
import {
  serializeLearnerResponses,
  draftsFromSavedResponses,
} from "./attemptIdempotency";
import { sampleLearnerResource } from "./studentOs.fixtures";

describe("learner response serialization", () => {
  it("emits JSON-boolean TRUE_FALSE values, never 1/0 or strings", () => {
    const questions = sampleLearnerResource().questions;
    const writes = serializeLearnerResponses(questions, {
      "q-tf": { booleanValue: true },
      "q-mc": { choiceValue: "Leaf" },
      "q-sa": { textValue: "Blade" },
    });
    const tf = writes.find((item) => item.response_kind === "TRUE_FALSE");
    expect(tf?.boolean_value).toBe(true);
    expect(typeof tf?.boolean_value).toBe("boolean");
    expect(JSON.stringify(writes)).toContain('"boolean_value":true');
    expect(JSON.stringify(writes)).not.toContain('"boolean_value":"true"');
    expect(JSON.stringify(writes)).not.toContain('"boolean_value":1');

    const falseWrites = serializeLearnerResponses(questions, {
      "q-tf": { booleanValue: false },
    });
    expect(JSON.stringify(falseWrites)).toContain('"boolean_value":false');
    expect(JSON.stringify(falseWrites)).not.toContain('"boolean_value":0');
    expect(JSON.stringify(falseWrites)).not.toContain('"boolean_value":"false"');
  });

  it("restores saved TRUE_FALSE booleans for resume", () => {
    const drafts = draftsFromSavedResponses([
      {
        question_id: "q-tf",
        response_kind: "TRUE_FALSE",
        boolean_value: false,
        choice_value: null,
        text_value: null,
      },
    ]);
    expect(drafts["q-tf"]?.booleanValue).toBe(false);
  });
});
