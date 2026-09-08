import type { LearnerResourceResponse } from "@/services/api/studentLearningApi";
import { contentTypeLabel } from "../assignmentPresentation";

export function LearnerWork({
  resource,
}: {
  resource: LearnerResourceResponse;
}) {
  return (
    <section className="panel stack" aria-labelledby="learner-work-heading">
      <div>
        <h2 id="learner-work-heading">{resource.title}</h2>
        <p className="muted">{contentTypeLabel(resource.content_type)}</p>
      </div>
      {resource.learning_objectives.length > 0 ? (
        <section>
          <h3>What you will practice</h3>
          <ul>
            {resource.learning_objectives.map((item) => (
              <li key={item.id}>{item.text}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {resource.instructions ? (
        <section>
          <h3>Instructions</h3>
          <p>{resource.instructions}</p>
        </section>
      ) : null}
    </section>
  );
}
