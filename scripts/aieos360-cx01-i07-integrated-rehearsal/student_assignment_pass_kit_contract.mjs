/** Student-authorized assignment DTO contract (learner-safe projection only). */

const EXPECTED_QUESTION_IDS = ["ws-1", "ws-2", "ws-3", "ws-4", "ws-5", "ws-6"];

export function assertStudentPassKitFromAssignmentDetail(detail, expected) {
  if (!detail || typeof detail !== "object") {
    throw new Error("Student assignment detail must be an object");
  }
  if (detail.content_id !== expected.contentId) {
    throw new Error("Student assignment content_id mismatch");
  }
  if (detail.content_version_id !== expected.versionId) {
    throw new Error("Student assignment content_version_id mismatch");
  }
  const resource = detail.resource;
  if (!resource || typeof resource !== "object") {
    throw new Error("Student assignment resource missing");
  }
  if (resource.title !== expected.title) {
    throw new Error("Student assignment resource title mismatch");
  }
  if (resource.content_id !== expected.contentId) {
    throw new Error("Student resource content_id mismatch");
  }
  if (resource.content_version_id !== expected.versionId) {
    throw new Error("Student resource content_version_id mismatch");
  }
  const questions = resource.questions;
  if (!Array.isArray(questions) || questions.length < 6) {
    throw new Error("Student resource must expose at least six learner questions");
  }
  const byId = new Map(questions.map((q) => [q.id, q]));
  for (const id of EXPECTED_QUESTION_IDS) {
    if (!byId.has(id)) {
      throw new Error(`Student resource missing learner question id ${id}`);
    }
  }
  const ws1 = byId.get("ws-1");
  const ws2 = byId.get("ws-2");
  const ws3 = byId.get("ws-3");
  const ws4 = byId.get("ws-4");
  if (ws1.question_type !== "MULTIPLE_CHOICE") {
    throw new Error("ws-1 must be MULTIPLE_CHOICE");
  }
  if (!ws1.options?.includes("1/2")) {
    throw new Error("ws-1 options must include 1/2");
  }
  if (ws2.question_type !== "SHORT_ANSWER") {
    throw new Error("ws-2 must be SHORT_ANSWER");
  }
  if (ws3.question_type !== "TRUE_FALSE") {
    throw new Error("ws-3 must be TRUE_FALSE");
  }
  if (ws4.question_type !== "MULTIPLE_CHOICE") {
    throw new Error("ws-4 must be MULTIPLE_CHOICE");
  }
  for (const question of questions) {
    if ("objective_ids" in question && question.objective_ids != null) {
      throw new Error("learner question must not expose objective_ids");
    }
    if ("answer" in question && question.answer != null) {
      throw new Error("learner question must not expose answers");
    }
  }
}
