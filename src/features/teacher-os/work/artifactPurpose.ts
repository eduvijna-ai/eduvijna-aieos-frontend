import {
  isPreparationArtifactKind,
  type PreparationArtifactKind,
} from "./preparationKit";

const ARTIFACT_PURPOSE: Record<PreparationArtifactKind, string> = {
  lesson_plan: "Lesson structure, activities and teaching sequence",
  worksheet: "Practice activities for learners",
  quiz: "Short check for understanding",
  homework: "Independent practice after the lesson",
  answer_key: "Answers and explanations for teacher use",
  teacher_notes: "Teaching cues, reminders and observations",
};

/** Presentation-only purpose copy. Never persist or treat as generated. */
export function artifactPurposeCopy(kind: string | null | undefined): string | null {
  if (!isPreparationArtifactKind(kind)) return null;
  return ARTIFACT_PURPOSE[kind];
}
