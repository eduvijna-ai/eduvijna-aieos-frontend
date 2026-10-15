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

  const sectionLabel = readOnly ? "Your submitted answers" : "Your answers";

  return (
    <section aria-labelledby="response-editor-heading">
      <h2 id="response-editor-heading" className="sos-section-title">
        {sectionLabel}
      </h2>
      <ol className="stack sos-questions">
        {questions.map((question, index) => {
          const answer = answers[question.id] ?? {};
          const name = `question-${question.id}`;
          return (
            <li key={question.id} className="panel sos-question">
              <div className="sos-question-header">
                <p className="sos-question-number">Question {index + 1}</p>
                <h3 className="sos-question-prompt">{question.prompt}</h3>
                <p className="muted sos-question-kind">
                  {questionKindLabel(question.question_type)}
                </p>
              </div>
              {question.question_type === "MULTIPLE_CHOICE" ? (
                <ul className="sos-options" role="list">
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
                <label className="sos-short-answer">
                  <span className="sr-only">Your answer for question {index + 1}</span>
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
                <ul className="sos-options" role="list">
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
    </section>
  );
}
