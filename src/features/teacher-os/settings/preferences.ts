import type { TeacherMemoryPreferencesBody } from "@/services/api/teacherMemoryApi";

/**
 * Closed Teacher Memory preference vocabulary (schema_version = 1).
 * Values must match Backend TeacherMemoryPreferencesBody exactly.
 */
export const TEACHING_STYLE_OPTIONS = [
  "balanced",
  "direct_instruction",
  "inquiry_led",
  "collaborative",
] as const;

export const PREFERRED_DIFFICULTY_OPTIONS = [
  "supportive",
  "standard",
  "challenging",
] as const;

export const PREPARATION_DETAIL_OPTIONS = [
  "concise",
  "balanced",
  "detailed",
] as const;

export const OUTPUT_FORMAT_OPTIONS = [
  "structured",
  "print_friendly",
] as const;

export type TeachingStyle = (typeof TEACHING_STYLE_OPTIONS)[number];
export type PreferredDifficulty =
  (typeof PREFERRED_DIFFICULTY_OPTIONS)[number];
export type PreparationDetail = (typeof PREPARATION_DETAIL_OPTIONS)[number];
export type OutputFormat = (typeof OUTPUT_FORMAT_OPTIONS)[number];

export const DEFAULT_TEACHER_MEMORY_PREFERENCES: TeacherMemoryPreferencesBody =
  {
    teaching_style: "balanced",
    preferred_difficulty: "standard",
    preparation_detail: "balanced",
    output_format: "structured",
    include_differentiation: false,
  };

export function clonePreferences(
  preferences: TeacherMemoryPreferencesBody,
): TeacherMemoryPreferencesBody {
  return {
    teaching_style: preferences.teaching_style,
    preferred_difficulty: preferences.preferred_difficulty,
    preparation_detail: preferences.preparation_detail,
    output_format: preferences.output_format,
    include_differentiation: preferences.include_differentiation,
  };
}

export function preferenceLabel(value: string): string {
  return value.replaceAll("_", " ");
}

/*
 * MEMORY → UI PREPARE DEFAULTS DEFERRED
 * No Prepare / generation context fields map cleanly onto Teacher Memory
 * preferences in this slice. Settings persists Memory only; Prepare does not
 * hydrate from Memory and Memory does not drive generation.
 */
