/** Frozen TeachingWorkArtifactsResponse contract (artifact_kind, not kind). */

export const CANONICAL_PREPARATION_ARTIFACT_KINDS = [
  "lesson_plan",
  "worksheet",
  "quiz",
  "homework",
  "answer_key",
  "teacher_notes",
];

export function sanitizedArtifactKindDiagnostics(items) {
  const kinds = (items ?? [])
    .map((row) => row?.artifact_kind)
    .filter((value) => typeof value === "string" && value.length > 0);
  return {
    row_count: items?.length ?? 0,
    kind_count: kinds.length,
    kind_names: [...new Set(kinds)].sort(),
  };
}

export function assertFreshPreparationKitArtifacts(payload, options) {
  const { workId, excludeContentId } = options;
  if (!payload || typeof payload !== "object") {
    throw new Error("artifacts payload must be an object");
  }
  if (payload.work_id !== workId) {
    throw new Error("artifacts work_id mismatch");
  }
  const items = payload.items;
  if (!Array.isArray(items)) {
    throw new Error("artifacts items must be an array");
  }
  const diagnostics = sanitizedArtifactKindDiagnostics(items);
  if (items.length !== CANONICAL_PREPARATION_ARTIFACT_KINDS.length) {
    throw new Error(
      `expected ${CANONICAL_PREPARATION_ARTIFACT_KINDS.length} artifact rows, diagnostics=${JSON.stringify(diagnostics)}`,
    );
  }
  for (const kind of CANONICAL_PREPARATION_ARTIFACT_KINDS) {
    const matches = items.filter((row) => row.artifact_kind === kind);
    if (matches.length !== 1) {
      throw new Error(
        `expected exactly one artifact_kind=${kind}, diagnostics=${JSON.stringify(diagnostics)}`,
      );
    }
  }
  if (items.some((row) => "kind" in row && row.kind != null)) {
    throw new Error("artifacts must use artifact_kind, not legacy kind field");
  }
  const generationRunIds = new Set(
    items
      .map((row) => row.generation_run_id)
      .filter((value) => typeof value === "string" && value.length > 0),
  );
  if (generationRunIds.size !== 1) {
    throw new Error(
      `expected one shared generation_run_id, diagnostics=${JSON.stringify(diagnostics)}`,
    );
  }
  const worksheetRows = items.filter((row) => row.artifact_kind === "worksheet");
  const worksheet = worksheetRows[0];
  if (!worksheet || worksheet.content_type !== "worksheet") {
    throw new Error("worksheet row must have content_type worksheet");
  }
  if (excludeContentId && items.some((row) => row.content_id === excludeContentId)) {
    throw new Error("fresh preparation kit must not reuse seeded showcase content_id");
  }
  return worksheet;
}
