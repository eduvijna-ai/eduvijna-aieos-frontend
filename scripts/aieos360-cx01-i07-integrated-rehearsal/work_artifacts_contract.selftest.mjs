import assert from "node:assert/strict";
import {
  assertFreshPreparationKitArtifacts,
  CANONICAL_PREPARATION_ARTIFACT_KINDS,
} from "./work_artifacts_contract.mjs";

const generationRunId = "00000000-0000-4000-8000-000000000099";
const items = CANONICAL_PREPARATION_ARTIFACT_KINDS.map((kind, index) => ({
  content_id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  version_id: `00000000-0000-4000-9000-${String(index + 1).padStart(12, "0")}`,
  content_type: kind,
  title: kind,
  artifact_kind: kind,
  generation_run_id: generationRunId,
}));

const worksheet = assertFreshPreparationKitArtifacts(
  { work_id: "00000000-0000-4000-8000-00000000abcd", items },
  {
    workId: "00000000-0000-4000-8000-00000000abcd",
    excludeContentId: "seeded-content-id",
  },
);
assert.equal(worksheet.artifact_kind, "worksheet");

assert.throws(() =>
  assertFreshPreparationKitArtifacts(
    {
      work_id: "00000000-0000-4000-8000-00000000abcd",
      items: items.map((row) => ({ ...row, artifact_kind: undefined, kind: row.artifact_kind })),
    },
    {
      workId: "00000000-0000-4000-8000-00000000abcd",
      excludeContentId: "seeded-content-id",
    },
  ),
);

assert.throws(() =>
  assertFreshPreparationKitArtifacts(
    {
      work_id: "00000000-0000-4000-8000-00000000abcd",
      items: items.map((row, index) =>
        index === 0 ? { ...row, generation_run_id: "" } : row,
      ),
    },
    {
      workId: "00000000-0000-4000-8000-00000000abcd",
      excludeContentId: "seeded-content-id",
    },
  ),
);

assert.throws(() =>
  assertFreshPreparationKitArtifacts(
    {
      work_id: "00000000-0000-4000-8000-00000000abcd",
      items: items.map((row) =>
        row.artifact_kind === "lesson_plan"
          ? { ...row, content_type: "education.lesson_plan" }
          : row,
      ),
    },
    {
      workId: "00000000-0000-4000-8000-00000000abcd",
      excludeContentId: "seeded-content-id",
    },
  ),
);

console.log("work_artifacts_contract.selftest: pass");
