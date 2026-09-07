import { ARTIFACT_CONTENT_TYPES, type ArtifactContentType } from "./artifactTypes";
import type {
  AnswerKeyArtifact,
  AnswerKeyEntry,
  AssessmentQuestion,
  HomeworkArtifact,
  LearningObjective,
  LessonPlanArtifact,
  LessonPlanSection,
  QuizArtifact,
  TeacherNotesArtifact,
  WorksheetArtifact,
} from "./artifactTypes";

export function isArtifactContentType(
  value: string | null | undefined,
): value is ArtifactContentType {
  return (
    typeof value === "string" &&
    (ARTIFACT_CONTENT_TYPES as readonly string[]).includes(value)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asStringList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const items: string[] = [];
  for (const entry of value) {
    const text = asTrimmedString(entry);
    if (!text) return null;
    items.push(text);
  }
  return items;
}

function asOptionalString(value: unknown): string | null {
  if (value == null) return null;
  return asTrimmedString(value);
}

function asLearningObjectives(value: unknown): LearningObjective[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const items: LearningObjective[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    const text = asTrimmedString(entry.text);
    if (!text) return null;
    items.push({
      id: asTrimmedString(entry.id) ?? "",
      text,
    });
  }
  return items;
}

function asObjectiveIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asTrimmedString(entry))
    .filter((entry): entry is string => entry != null);
}

function asLessonSections(value: unknown): LessonPlanSection[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const sections: LessonPlanSection[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    const title = asTrimmedString(entry.title);
    const teacherActions = asTrimmedString(entry.teacher_actions);
    const learnerActions = asTrimmedString(entry.learner_actions);
    if (!title || !teacherActions || !learnerActions) return null;
    const minutes = entry.estimated_minutes;
    sections.push({
      title,
      teacherActions,
      learnerActions,
      estimatedMinutes:
        typeof minutes === "number" && Number.isFinite(minutes) && minutes > 0
          ? minutes
          : null,
      objectiveIds: asObjectiveIds(entry.objective_ids),
    });
  }
  return sections;
}

function asQuestions(value: unknown): AssessmentQuestion[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const questions: AssessmentQuestion[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    const prompt = asTrimmedString(entry.prompt);
    if (!prompt) return null;
    const options = Array.isArray(entry.options)
      ? entry.options
          .map((option) => asTrimmedString(option))
          .filter((option): option is string => option != null)
      : [];
    questions.push({
      prompt,
      questionType: asOptionalString(entry.question_type),
      options,
      visualDescription: asOptionalString(entry.visual_description),
      difficulty: asOptionalString(entry.difficulty),
      bloomLevel: asOptionalString(entry.bloom_level),
    });
  }
  return questions;
}

export function parseLessonPlanPayload(
  payload: unknown,
): LessonPlanArtifact | null {
  if (!isRecord(payload)) return null;
  const title = asTrimmedString(payload.title);
  const opening = asTrimmedString(payload.opening);
  const closure = asTrimmedString(payload.closure);
  const formativeCheck = asTrimmedString(payload.formative_check);
  const learningObjectives = asLearningObjectives(payload.learning_objectives);
  const materials = asStringList(payload.materials);
  const sections = asLessonSections(payload.sections);
  if (
    !title ||
    !opening ||
    !closure ||
    !formativeCheck ||
    !learningObjectives ||
    !materials ||
    !sections
  ) {
    return null;
  }
  return {
    title,
    learningObjectives,
    materials,
    opening,
    sections,
    closure,
    formativeCheck,
  };
}

export function parseWorksheetPayload(
  payload: unknown,
): WorksheetArtifact | null {
  if (!isRecord(payload)) return null;
  const title = asTrimmedString(payload.title);
  const instructions = asTrimmedString(payload.instructions);
  const learningObjectives = asLearningObjectives(payload.learning_objectives);
  const questions = asQuestions(payload.questions);
  if (!title || !instructions || !learningObjectives || !questions) {
    return null;
  }
  return {
    title,
    teacherSummary: asOptionalString(payload.teacher_summary),
    learningObjectives,
    instructions,
    questions,
  };
}

export function parseQuizPayload(payload: unknown): QuizArtifact | null {
  if (!isRecord(payload)) return null;
  const title = asTrimmedString(payload.title);
  const instructions = asTrimmedString(payload.instructions);
  const learningObjectives = asLearningObjectives(payload.learning_objectives);
  const questions = asQuestions(payload.questions);
  if (!title || !instructions || !learningObjectives || !questions) {
    return null;
  }
  return { title, learningObjectives, instructions, questions };
}

export function parseHomeworkPayload(
  payload: unknown,
): HomeworkArtifact | null {
  if (!isRecord(payload)) return null;
  const title = asTrimmedString(payload.title);
  const instructions = asTrimmedString(payload.instructions);
  const learningObjectives = asLearningObjectives(payload.learning_objectives);
  const questions = asQuestions(payload.questions);
  if (!title || !instructions || !learningObjectives || !questions) {
    return null;
  }
  return { title, learningObjectives, instructions, questions };
}

function asAnswerKeyEntries(value: unknown): AnswerKeyEntry[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const entries: AnswerKeyEntry[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    const sourceArtifactKind = asTrimmedString(entry.source_artifact_kind);
    const answer = asTrimmedString(entry.answer);
    const explanation = asTrimmedString(entry.explanation);
    if (!sourceArtifactKind || !answer || !explanation) return null;
    entries.push({ sourceArtifactKind, answer, explanation });
  }
  return entries;
}

export function parseAnswerKeyPayload(
  payload: unknown,
): AnswerKeyArtifact | null {
  if (!isRecord(payload)) return null;
  const title = asTrimmedString(payload.title);
  const entries = asAnswerKeyEntries(payload.entries);
  if (!title || !entries) return null;
  return { title, entries };
}

export function parseTeacherNotesPayload(
  payload: unknown,
): TeacherNotesArtifact | null {
  if (!isRecord(payload)) return null;
  const title = asTrimmedString(payload.title);
  const notes = asStringList(payload.notes);
  if (!title || !notes || notes.length === 0) return null;
  return { title, notes };
}

export function objectiveTextsForIds(
  ids: string[],
  objectives: LearningObjective[],
): string[] {
  const byId = new Map(
    objectives
      .filter((objective) => objective.id)
      .map((objective) => [objective.id, objective.text]),
  );
  const texts: string[] = [];
  for (const id of ids) {
    const text = byId.get(id);
    if (text && !texts.includes(text)) texts.push(text);
  }
  return texts;
}
