const OBJECTIVES = [
  { id: "obj-1", text: "Identify equivalent fractions" },
  { id: "obj-2", text: "Represent fractions visually" },
];

function question(overrides: Record<string, unknown> = {}) {
  return {
    id: "q-1",
    prompt: "Which fraction is equivalent to 1/2?",
    question_type: "multiple_choice",
    difficulty: "easy",
    bloom_level: "understand",
    objective_ids: ["obj-1"],
    options: ["1/4", "2/4", "3/4", "4/4"],
    answer: "2/4",
    explanation: "Two quarters equal one half.",
    visual_description: "A circle split into two equal parts.",
    ...overrides,
  };
}

export const lessonPlanPayload = {
  title: "Fractions lesson",
  learning_objectives: OBJECTIVES,
  objective_ids: ["obj-1", "obj-2"],
  materials: ["fraction tiles", "whiteboard"],
  opening: "Activate prior knowledge with a pizza model.",
  sections: [
    {
      id: "sec-1",
      title: "Explore equivalent fractions",
      objective_ids: ["obj-1"],
      teacher_actions: "Demonstrate halves and quarters.",
      learner_actions: "Build models with tiles.",
      estimated_minutes: 12,
    },
  ],
  closure: "Summarize equivalent fractions.",
  formative_check: "Ask one exit ticket question.",
};

export const worksheetPayload = {
  title: "Fractions Worksheet",
  teacher_summary: "Practice worksheet for visual fractions.",
  learning_objectives: OBJECTIVES,
  instructions: "Complete the following questions.",
  questions: [
    question(),
    question({
      id: "q-2",
      prompt: "Write a fraction equal to one half.",
      question_type: "short_answer",
      options: [],
      answer: "2/4",
      explanation: "Any even numerator/denominator pair can work.",
      visual_description: null,
      objective_ids: ["obj-2"],
    }),
  ],
  teacher_notes: "Review visual models before assigning.",
};

export const quizPayload = {
  title: "Fractions quiz",
  learning_objectives: OBJECTIVES,
  instructions: "Answer independently.",
  questions: [
    question({
      id: "quiz-1",
      prompt: "Is 2/4 equal to 1/2?",
      question_type: "true_false",
      options: [],
      answer: "true",
      explanation: "They represent the same amount.",
      visual_description: null,
    }),
  ],
};

export const homeworkPayload = {
  title: "Fractions homework",
  learning_objectives: OBJECTIVES,
  instructions: "Complete at home.",
  questions: [
    question({
      id: "h-1",
      prompt: "Shade a model that shows 1/2.",
      visual_description: "An empty rectangle divided into four parts.",
    }),
  ],
};

export const answerKeyPayload = {
  title: "Fractions answer key",
  entries: [
    {
      source_artifact_kind: "worksheet",
      source_question_id: "q-1",
      answer: "2/4",
      explanation: "Two quarters equal one half.",
    },
    {
      source_artifact_kind: "quiz",
      source_question_id: "quiz-1",
      answer: "true",
      explanation: "They represent the same amount.",
    },
    {
      source_artifact_kind: "homework",
      source_question_id: "h-1",
      answer: "Any model with half shaded.",
      explanation: "Equal parts must be the same size.",
    },
  ],
};

export const teacherNotesPayload = {
  title: "Fractions teaching notes",
  notes: [
    "Watch for common half/quarter confusion.",
    "Use pizza models before number lines.",
  ],
};

export const longPrompt =
  "Supercalifragilisticexpialidocious-equivalent-fraction-reasoning-across-an-unbroken-token-".repeat(
    4,
  );

export const longWorksheetPayload = {
  ...worksheetPayload,
  title: "Long content worksheet",
  questions: [
    question({
      prompt: longPrompt,
      options: [
        `${longPrompt}-option-a`,
        "2/4",
        "3/4",
        "4/4",
      ],
    }),
  ],
};
