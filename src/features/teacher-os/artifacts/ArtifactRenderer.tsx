import type { ReactNode } from "react";
import {
  parseAnswerKeyPayload,
  parseHomeworkPayload,
  parseLessonPlanPayload,
  parseQuizPayload,
  parseTeacherNotesPayload,
  parseWorksheetPayload,
} from "./artifactGuards";
import { AnswerKeyRenderer } from "./AnswerKeyRenderer";
import { HomeworkRenderer } from "./HomeworkRenderer";
import { LessonPlanRenderer } from "./LessonPlanRenderer";
import { QuizRenderer } from "./QuizRenderer";
import { TeacherNotesRenderer } from "./TeacherNotesRenderer";
import { UnsupportedArtifact } from "./UnsupportedArtifact";
import { WorksheetRenderer } from "./WorksheetRenderer";
import "./artifactRenderer.css";

/**
 * Teacher-facing document renderer. Dispatches from canonical content_type.
 * Does not mutate payloads; unknown or invalid payloads fail safely.
 */
export function ArtifactRenderer({
  contentType,
  payload,
}: {
  contentType: string;
  payload: unknown;
}) {
  let rendered: ReactNode;

  switch (contentType) {
    case "lesson_plan": {
      const plan = parseLessonPlanPayload(payload);
      rendered = plan ? (
        <LessonPlanRenderer plan={plan} />
      ) : (
        <UnsupportedArtifact />
      );
      break;
    }
    case "worksheet": {
      const worksheet = parseWorksheetPayload(payload);
      rendered = worksheet ? (
        <WorksheetRenderer worksheet={worksheet} />
      ) : (
        <UnsupportedArtifact />
      );
      break;
    }
    case "quiz": {
      const quiz = parseQuizPayload(payload);
      rendered = quiz ? <QuizRenderer quiz={quiz} /> : <UnsupportedArtifact />;
      break;
    }
    case "homework": {
      const homework = parseHomeworkPayload(payload);
      rendered = homework ? (
        <HomeworkRenderer homework={homework} />
      ) : (
        <UnsupportedArtifact />
      );
      break;
    }
    case "answer_key": {
      const answerKey = parseAnswerKeyPayload(payload);
      rendered = answerKey ? (
        <AnswerKeyRenderer answerKey={answerKey} />
      ) : (
        <UnsupportedArtifact />
      );
      break;
    }
    case "teacher_notes": {
      const notes = parseTeacherNotesPayload(payload);
      rendered = notes ? (
        <TeacherNotesRenderer notes={notes} />
      ) : (
        <UnsupportedArtifact />
      );
      break;
    }
    default:
      rendered = <UnsupportedArtifact />;
  }

  return <div className="artifact-host" data-testid="artifact-document">{rendered}</div>;
}
