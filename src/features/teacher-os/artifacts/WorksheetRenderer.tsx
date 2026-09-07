import type { WorksheetArtifact } from "./artifactTypes";
import { AssessmentQuestions, ObjectiveList } from "./AssessmentQuestions";

export function WorksheetRenderer({ worksheet }: { worksheet: WorksheetArtifact }) {
  return (
    <article className="artifact-document" aria-label="Worksheet">
      <p className="artifact-kicker">Worksheet</p>
      <h2>{worksheet.title}</h2>
      {worksheet.teacherSummary ? (
        <p className="artifact-lede">{worksheet.teacherSummary}</p>
      ) : null}

      <ObjectiveList
        objectives={worksheet.learningObjectives}
        heading="Learning goals"
      />

      <section className="artifact-section" aria-labelledby="artifact-instructions-heading">
        <h3 id="artifact-instructions-heading">Instructions</h3>
        <p className="artifact-prose">{worksheet.instructions}</p>
      </section>

      <AssessmentQuestions questions={worksheet.questions} />
    </article>
  );
}
