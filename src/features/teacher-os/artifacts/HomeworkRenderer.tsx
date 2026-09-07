import type { HomeworkArtifact } from "./artifactTypes";
import { AssessmentQuestions, ObjectiveList } from "./AssessmentQuestions";

export function HomeworkRenderer({ homework }: { homework: HomeworkArtifact }) {
  return (
    <article className="artifact-document" aria-label="Homework">
      <p className="artifact-kicker">Homework</p>
      <h2>{homework.title}</h2>

      <ObjectiveList objectives={homework.learningObjectives} />

      <section className="artifact-section" aria-labelledby="artifact-instructions-heading">
        <h3 id="artifact-instructions-heading">Instructions</h3>
        <p className="artifact-prose">{homework.instructions}</p>
      </section>

      <AssessmentQuestions
        questions={homework.questions}
        heading="Homework questions"
      />
    </article>
  );
}
