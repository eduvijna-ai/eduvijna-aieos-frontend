import type { LearnerQuestionResponse } from "@/services/api/studentLearningApi";
import { questionKindLabel } from "../assignmentPresentation";
import type { DraftAnswer } from "../attemptIdempotency";

export function ResponseEditor({
  questions,
  answers,
  readOnly,
  onChange,
}: {
  questions: readonly LearnerQuestionResponse[];
  answers: Record<string, DraftAnswer>;
  readOnly: boolean;
  onChange: (questionId: string, answer: DraftAnswer) => void;
}) {
  if (questions.length === 0) {
    return <p className="muted">This work has no questions to answer.</p>;
  }

  return (
    <ol className="stack" aria-label="Questions">
      {questions.map((question, index) => {
        const answer = answers[question.id] ?? {};
        const name = `question-${question.id}`;
        return (
          <li key={question.id} className="panel sos-question">
            <p>
              <strong>Question {index + 1}.</strong> {question.prompt}
            </p>
            <p className="muted">{questionKindLabel(question.question_type)}</p>
            {question.question_type === "MULTIPLE_CHOICE" ? (
              <ul className="sos-options">
                {question.options.map((option) => (
                  <li key={option} className="sos-option">
                    <label>
                      <input
                        type="radio"
                        name={name}
                        value={option}
                        checked={answer.choiceValue === option}
                        disabled={readOnly}
                        onChange={() =>
                          onChange(question.id, { choiceValue: option })
                        }
                      />{" "}
                      {option}
                    </label>
                  </li>
                ))}
              </ul>
            ) : null}
            {question.question_type === "SHORT_ANSWER" ? (
              <label>
                <span className="sr-only">Your answer</span>
                <textarea
                  name={name}
                  value={answer.textValue ?? ""}
                  disabled={readOnly}
                  onChange={(event) =>
                    onChange(question.id, { textValue: event.target.value })
                  }
                />
              </label>
            ) : null}
            {question.question_type === "TRUE_FALSE" ? (
              <ul className="sos-options">
                <li className="sos-option">
                  <label>
                    <input
                      type="radio"
                      name={name}
                      checked={answer.booleanValue === true}
                      disabled={readOnly}
                      onChange={() =>
                        onChange(question.id, { booleanValue: true })
                      }
                    />{" "}
                    True
                  </label>
                </li>
                <li className="sos-option">
                  <label>
                    <input
                      type="radio"
                      name={name}
                      checked={answer.booleanValue === false}
                      disabled={readOnly}
                      onChange={() =>
                        onChange(question.id, { booleanValue: false })
                      }
                    />{" "}
                    False
                  </label>
                </li>
              </ul>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
