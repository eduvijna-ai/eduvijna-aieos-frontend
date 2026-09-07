import type { QuizArtifact } from "./artifactTypes";
import { AssessmentQuestions, ObjectiveList } from "./AssessmentQuestions";

export function QuizRenderer({ quiz }: { quiz: QuizArtifact }) {
  return (
    <article
      className="artifact-document artifact-document--quiz"
      aria-label="Quick Quiz"
    >
      <p className="artifact-kicker">Quick Quiz</p>
      <h2>{quiz.title}</h2>

      <ObjectiveList objectives={quiz.learningObjectives} />

      <section className="artifact-section" aria-labelledby="artifact-instructions-heading">
        <h3 id="artifact-instructions-heading">Instructions</h3>
        <p className="artifact-prose">{quiz.instructions}</p>
      </section>

      <AssessmentQuestions questions={quiz.questions} />
    </article>
  );
}
