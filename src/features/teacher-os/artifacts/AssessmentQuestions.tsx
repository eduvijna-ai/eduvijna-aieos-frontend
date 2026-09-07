import type { LearningObjective } from "./artifactTypes";
import {
  bloomLabel,
  difficultyLabel,
  questionTypeLabel,
} from "./artifactLabels";
import type { AssessmentQuestion } from "./artifactTypes";

export function ObjectiveList({
  objectives,
  heading = "Learning objectives",
}: {
  objectives: LearningObjective[];
  heading?: string;
}) {
  return (
    <section className="artifact-section" aria-labelledby="artifact-objectives-heading">
      <h3 id="artifact-objectives-heading">{heading}</h3>
      <ul className="artifact-list">
        {objectives.map((objective, index) => (
          <li key={objective.id || `objective-${index}`}>{objective.text}</li>
        ))}
      </ul>
    </section>
  );
}

export function QuestionMeta({ question }: { question: AssessmentQuestion }) {
  const typeLabel = questionTypeLabel(question.questionType);
  const difficulty = difficultyLabel(question.difficulty);
  const bloom = bloomLabel(question.bloomLevel);
  if (!typeLabel && !difficulty && !bloom) return null;
  return (
    <p className="artifact-question-meta">
      {typeLabel ? <span className="artifact-chip">{typeLabel}</span> : null}
      {difficulty ? <span className="artifact-chip">{difficulty}</span> : null}
      {bloom ? <span className="artifact-chip">Bloom: {bloom}</span> : null}
    </p>
  );
}

export function AssessmentQuestions({
  questions,
  heading = "Questions",
}: {
  questions: AssessmentQuestion[];
  heading?: string;
}) {
  return (
    <section className="artifact-section" aria-labelledby="artifact-questions-heading">
      <h3 id="artifact-questions-heading">{heading}</h3>
      <ol className="artifact-question-list">
        {questions.map((question, index) => (
          <li key={`question-${index}`} className="artifact-question">
            <p className="artifact-question-prompt">{question.prompt}</p>
            <QuestionMeta question={question} />
            {question.visualDescription ? (
              <p className="artifact-visual">
                Visual: {question.visualDescription}
              </p>
            ) : null}
            {question.options.length > 0 ? (
              <ul className="artifact-options">
                {question.options.map((option, optionIndex) => (
                  <li key={`${index}-${optionIndex}`} className="artifact-option">
                    <span className="artifact-option-mark" aria-hidden="true" />
                    <span className="artifact-option-text">{option}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
