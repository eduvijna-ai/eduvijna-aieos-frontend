import assert from "node:assert/strict";
import { assertStudentPassKitFromAssignmentDetail } from "./student_assignment_pass_kit_contract.mjs";

const contentId = "00000000-0000-4000-8000-000000000001";
const versionId = "00000000-0000-4000-9000-000000000001";
const title = "Fractions worksheet";

const questions = ["ws-1", "ws-2", "ws-3", "ws-4", "ws-5", "ws-6"].map(
  (id, index) => ({
    id,
    prompt: `Prompt for ${id}`,
    question_type: (["multiple_choice", "short_answer", "true_false"])[index % 3],
    options: index % 3 === 0 ? ["1/2", "1/3", "1/4", "2/3"] : [],
  }),
);

assertStudentPassKitFromAssignmentDetail(
  {
    content_id: contentId,
    content_version_id: versionId,
    resource: {
      title,
      content_id: contentId,
      content_version_id: versionId,
      questions,
    },
  },
  { contentId, versionId, title },
);

assert.throws(() =>
  assertStudentPassKitFromAssignmentDetail(
    {
      content_id: contentId,
      content_version_id: versionId,
      resource: {
        title,
        content_id: contentId,
        content_version_id: versionId,
        questions: questions.map((q) => ({ ...q, answer: "secret" })),
      },
    },
    { contentId, versionId, title },
  ),
);

console.log("student_assignment_pass_kit_contract.selftest: pass");
