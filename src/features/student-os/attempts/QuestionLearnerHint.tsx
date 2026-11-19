export type LearnerHintViewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "shown"; text: string }
  | { status: "empty" }
  | { status: "error" };

const HINT_ERROR_COPY = "We could not load a hint right now. Try again.";
const HINT_EMPTY_COPY = "No hint available for this question";

export function QuestionLearnerHint({
  questionId,
  questionNumber,
  enabled,
  view,
  onRequest,
}: {
  questionId: string;
  questionNumber: number;
  enabled: boolean;
  view: LearnerHintViewState;
  onRequest: () => void;
}) {
  if (!enabled) {
    return null;
  }

  const regionId = `learner-hint-outcome-${questionId}`;
  const actionLabel = `Show hint for question ${questionNumber}`;

  return (
    <div className="sos-learner-hint">
      <button
        type="button"
        className="btn btn-secondary sos-learner-hint-trigger"
        aria-label={actionLabel}
        aria-controls={regionId}
        aria-expanded={
          view.status === "shown" || view.status === "empty" ? true : undefined
        }
        aria-busy={view.status === "loading"}
        disabled={view.status === "loading"}
        onClick={onRequest}
      >
        {view.status === "loading" ? "Loading hint…" : "Show hint"}
      </button>
      <div
        id={regionId}
        className="sos-learner-hint-outcome"
        aria-live="polite"
        aria-atomic="true"
      >
        {view.status === "loading" ? (
          <p className="muted sos-learner-hint-status" role="status">
            Loading hint…
          </p>
        ) : null}
        {view.status === "shown" ? (
          <p className="sos-learner-hint-text">{view.text}</p>
        ) : null}
        {view.status === "empty" ? (
          <p className="muted sos-learner-hint-empty">{HINT_EMPTY_COPY}</p>
        ) : null}
        {view.status === "error" ? (
          <p className="sos-learner-hint-error" role="alert">
            {HINT_ERROR_COPY}
          </p>
        ) : null}
      </div>
    </div>
  );
}