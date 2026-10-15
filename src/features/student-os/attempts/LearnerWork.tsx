import type { LearnerResourceResponse } from "@/services/api/studentLearningApi";
import { contentTypeLabel } from "../assignmentPresentation";

export function LearnerWork({
  resource,
  compact = false,
}: {
  resource: LearnerResourceResponse;
  /** On attempt pages, title/type already appear in the page header. */
  compact?: boolean;
}) {
  return (
    <section
      className="panel stack sos-learner-work"
      aria-labelledby="learner-work-heading"
    >
      {compact ? (
        <h2 id="learner-work-heading" className="sos-section-title">
          About this work
        </h2>
      ) : (
        <div>
          <h2 id="learner-work-heading">{resource.title}</h2>
          <p className="muted">{contentTypeLabel(resource.content_type)}</p>
        </div>
      )}
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
