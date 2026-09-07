import type { EducationalQuality } from "@/services/api/generated/teachingTypes";

const QUALITY_CHECK_LABELS: Record<string, string> = {
  schema_valid: "Content structure valid",
  shared_objectives_present: "Learning objectives aligned",
  lesson_plan_objectives_mapped: "Lesson activities aligned",
  worksheet_objectives_mapped: "Worksheet aligned to objectives",
  quiz_objectives_mapped: "Quiz aligned to objectives",
  homework_objectives_mapped: "Homework aligned to objectives",
  age_appropriate: "Age appropriate",
  curriculum_aligned: "Curriculum aligned",
};

export function humanizeSnakeCase(value: string): string {
  const words = value
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.toLowerCase());
  if (words.length === 0) return value;
  const [first, ...rest] = words;
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(" ");
}

/** Teacher-facing label for a quality check code. Unknown codes humanize safely. */
export function qualityCheckLabel(code: string): string {
  return QUALITY_CHECK_LABELS[code] ?? humanizeSnakeCase(code);
}

export function isEducationalQualityPass(quality: EducationalQuality): boolean {
  return quality.status === "PASS";
}

export function qualityPassedCount(quality: EducationalQuality): number {
  return quality.checks.filter((check) => check.passed).length;
}

export function qualitySummaryText(quality: EducationalQuality): string {
  const total = quality.checks.length;
  const passedCount = qualityPassedCount(quality);
  if (isEducationalQualityPass(quality)) {
    if (total === 1) return "✓ 1 quality check passed";
    if (total > 1) return `✓ ${total} quality checks passed`;
    return "✓ Educational quality passed";
  }
  if (total === 0) return "Educational quality needs attention";
  return `${passedCount} of ${total} quality checks passed`;
}
