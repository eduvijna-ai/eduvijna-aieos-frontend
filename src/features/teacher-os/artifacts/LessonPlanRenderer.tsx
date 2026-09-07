import { objectiveTextsForIds } from "./artifactGuards";
import type { LessonPlanArtifact } from "./artifactTypes";
import { ObjectiveList } from "./AssessmentQuestions";

export function LessonPlanRenderer({ plan }: { plan: LessonPlanArtifact }) {
  return (
    <article className="artifact-document" aria-label="Lesson Plan">
      <p className="artifact-kicker">Lesson Plan</p>
      <h2>{plan.title}</h2>

      <ObjectiveList objectives={plan.learningObjectives} />

      <section className="artifact-section" aria-labelledby="artifact-materials-heading">
        <h3 id="artifact-materials-heading">Materials</h3>
        <ul className="artifact-list">
          {plan.materials.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="artifact-section" aria-labelledby="artifact-opening-heading">
        <h3 id="artifact-opening-heading">Opening</h3>
        <p className="artifact-prose">{plan.opening}</p>
      </section>

      <section className="artifact-section" aria-labelledby="artifact-sections-heading">
        <h3 id="artifact-sections-heading">Lesson sections</h3>
        {plan.sections.map((section, index) => {
          const mapped = objectiveTextsForIds(
            section.objectiveIds,
            plan.learningObjectives,
          );
          return (
            <article
              key={`${section.title}-${index}`}
              className="artifact-lesson-section"
            >
              <h4>
                {index + 1}. {section.title}
              </h4>
              {section.estimatedMinutes != null ? (
                <p className="artifact-minutes">
                  About {section.estimatedMinutes}{" "}
                  {section.estimatedMinutes === 1 ? "minute" : "minutes"}
                </p>
              ) : null}
              {mapped.length > 0 ? (
                <p className="muted">
                  Focus: {mapped.join(" · ")}
                </p>
              ) : null}
              <div className="artifact-pair">
                <div>
                  <h5>Teacher</h5>
                  <p>{section.teacherActions}</p>
                </div>
                <div>
                  <h5>Learners</h5>
                  <p>{section.learnerActions}</p>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="artifact-section" aria-labelledby="artifact-closure-heading">
        <h3 id="artifact-closure-heading">Closure</h3>
        <p className="artifact-prose">{plan.closure}</p>
      </section>

      <section className="artifact-section" aria-labelledby="artifact-formative-heading">
        <h3 id="artifact-formative-heading">Formative check</h3>
        <p className="artifact-prose">{plan.formativeCheck}</p>
      </section>
    </article>
  );
}
