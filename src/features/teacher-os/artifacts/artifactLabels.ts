import { preparationArtifactLabel } from "@/features/teacher-os/work/preparationKit";
import { stewardshipStatusLabel } from "@/features/teacher-os/work/stewardshipLabel";

const QUESTION_TYPE_LABELS: Record<string, string> = {
  multiple_choice: "Multiple choice",
  short_answer: "Short answer",
  true_false: "True or false",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

const BLOOM_LABELS: Record<string, string> = {
  remember: "Remember",
  understand: "Understand",
  apply: "Apply",
  analyze: "Analyze",
  evaluate: "Evaluate",
  create: "Create",
};

/** Normalize dotted historical types (lesson.plan) to canonical kinds. */
export function canonicalContentType(
  contentType: string | null | undefined,
): string {
  return (contentType ?? "").trim().replace(/\./g, "_");
}

export function artifactTypeLabel(contentType: string | null | undefined): string {
  const canonical = canonicalContentType(contentType);
  return preparationArtifactLabel(canonical || contentType);
}

export function stewardshipLabel(state: string | null | undefined): string {
  if (!state) return "Unknown";
  return stewardshipStatusLabel(state);
}

export function publicationLabel(publishedVersionId: string | null | undefined): string {
  return publishedVersionId ? "Published" : "Not published";
}

export function questionTypeLabel(value: string | null): string | null {
  if (!value) return null;
  return QUESTION_TYPE_LABELS[value] ?? humanizeToken(value);
}

export function difficultyLabel(value: string | null): string | null {
  if (!value) return null;
  return DIFFICULTY_LABELS[value] ?? humanizeToken(value);
}

export function bloomLabel(value: string | null): string | null {
  if (!value) return null;
  return BLOOM_LABELS[value] ?? humanizeToken(value);
}

function humanizeToken(value: string): string {
  return value
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
