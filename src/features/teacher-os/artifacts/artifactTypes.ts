/** Canonical Teacher OS content types — dispatch keys, not payload inference. */
export const ARTIFACT_CONTENT_TYPES = [
  "lesson_plan",
  "worksheet",
  "quiz",
  "homework",
  "answer_key",
  "teacher_notes",
] as const;

export type ArtifactContentType = (typeof ARTIFACT_CONTENT_TYPES)[number];

export type LearningObjective = {
  id: string;
  text: string;
};

export type LessonPlanSection = {
  title: string;
  teacherActions: string;
  learnerActions: string;
  estimatedMinutes: number | null;
  objectiveIds: string[];
};

export type LessonPlanArtifact = {
  title: string;
  learningObjectives: LearningObjective[];
  materials: string[];
  opening: string;
  sections: LessonPlanSection[];
  closure: string;
  formativeCheck: string;
};

export type AssessmentQuestion = {
  prompt: string;
  questionType: string | null;
  options: string[];
  visualDescription: string | null;
  difficulty: string | null;
  bloomLevel: string | null;
};

export type WorksheetArtifact = {
  title: string;
  teacherSummary: string | null;
  learningObjectives: LearningObjective[];
  instructions: string;
  questions: AssessmentQuestion[];
};

export type QuizArtifact = {
  title: string;
  learningObjectives: LearningObjective[];
  instructions: string;
  questions: AssessmentQuestion[];
};

export type HomeworkArtifact = {
  title: string;
  learningObjectives: LearningObjective[];
  instructions: string;
  questions: AssessmentQuestion[];
};

export type AnswerKeyEntry = {
  sourceArtifactKind: string;
  answer: string;
  explanation: string;
};

export type AnswerKeyArtifact = {
  title: string;
  entries: AnswerKeyEntry[];
};

export type TeacherNotesArtifact = {
  title: string;
  notes: string[];
};
