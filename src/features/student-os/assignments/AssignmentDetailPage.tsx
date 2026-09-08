import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getStudentAssignment,
  startLearningAttempt,
  type StudentAssignmentResponse,
} from "@/services/api/studentLearningApi";
import { useSession } from "@/services/session/useSession";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { StatusBadge } from "@/shared/components/StatusBadge";
import {
  assignmentAvailabilityLabel,
  assignmentTitle,
  attemptProgressLabel,
  availableFromLabel,
  contentTypeLabel,
  dueLabel,
} from "../assignmentPresentation";
import {
  retainOrMintIdempotencyKey,
  startAttemptMaterial,
} from "../attemptIdempotency";
import { studentMessageForApiError } from "../studentMessages";
import { LearnerWork } from "../attempts/LearnerWork";

export function AssignmentDetailPage() {
  const { assignmentId = "" } = useParams();
  const navigate = useNavigate();
  const { isConnected, isProduction } = useSession();
  const [status, setStatus] = useState<
    "loading" | "ready" | "error" | "unavailable"
  >("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [assignment, setAssignment] = useState<StudentAssignmentResponse | null>(
    null,
  );
  const [starting, setStarting] = useState(false);
  const startKeyRef = useRef<string | null>(null);
  const startMaterialRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!isConnected && !isProduction) {
      setStatus("unavailable");
      setAssignment(null);
      return;
    }
    setStatus("loading");
    setErrorMessage("");
    try {
      const { data } = await getStudentAssignment(assignmentId);
      setAssignment(data);
      setStatus("ready");
    } catch (error) {
      setErrorMessage(studentMessageForApiError(error));
      setStatus("error");
    }
  }, [assignmentId, isConnected, isProduction]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onStart() {
    if (!assignment) return;
    setStarting(true);
    setActionError("");
    const material = startAttemptMaterial(assignment.assignment_id);
    const key = retainOrMintIdempotencyKey(
      material,
      startKeyRef,
      startMaterialRef,
    );
    try {
      const { data } = await startLearningAttempt(
        assignment.assignment_id,
        key,
      );
      navigate(`/student-os/attempts/${data.attempt_id}`);
    } catch (error) {
      setActionError(studentMessageForApiError(error));
    } finally {
      setStarting(false);
    }
  }

  if (status === "unavailable") {
    return (
      <EmptyState
        title="Connect a student session"
        description="Assignment details load from AIEOS."
      />
    );
  }

  if (status === "loading") {
    return <LoadingState label="Loading assignment…" />;
  }

  if (status === "error" || !assignment) {
    return (
      <ErrorState
        title="Could not open this assignment"
        message={errorMessage}
        onRetry={() => {
          void load();
        }}
      />
    );
  }

  const title = assignmentTitle(assignment);
  const typeLabel = contentTypeLabel(
    assignment.resource?.content_type ?? "Assigned work",
  );
  const canStart =
    assignment.currently_consumable &&
    assignment.attempt_summary === "NOT_STARTED";
  const resumeHref =
    assignment.attempt_id != null
      ? `/student-os/attempts/${assignment.attempt_id}`
      : null;

  return (
    <article className="stack sos-page">
      <header>
        <p className="muted">
          <Link to="/student-os/home">Home</Link> ·{" "}
          <Link to="/student-os/assignments">Assignments</Link>
        </p>
        <h1>{title}</h1>
        <p className="muted">{typeLabel}</p>
        <div className="sos-actions">
          <StatusBadge
            label={attemptProgressLabel(assignment.attempt_summary)}
            kind={assignment.attempt_summary}
          />
          <StatusBadge label={assignmentAvailabilityLabel(assignment)} />
        </div>
      </header>

      <section className="panel stack">
        <h2>Assigned version</h2>
        <p>
          This is the exact version assigned to you. Later publications do not
          replace this work.
        </p>
        <dl className="sos-meta">
          <div>
            <dt>Timing</dt>
            <dd>
              {availableFromLabel(assignment)}
              <br />
              {dueLabel(assignment)}
            </dd>
          </div>
          <div>
            <dt>Class</dt>
            <dd>{assignment.class_ref}</dd>
          </div>
        </dl>
      </section>

      {assignment.resource ? (
        <LearnerWork resource={assignment.resource} />
      ) : (
        <p className="muted">The assigned content could not be shown.</p>
      )}

      {actionError ? (
        <p className="status-region" role="alert">
          {actionError}
        </p>
      ) : null}

      <div className="sos-actions">
        {canStart ? (
          <button
            type="button"
            className="btn"
            onClick={() => {
              void onStart();
            }}
            disabled={starting}
          >
            {starting ? "Starting…" : "Start this work"}
          </button>
        ) : null}
        {resumeHref && assignment.attempt_summary === "IN_PROGRESS" ? (
          <Link className="btn" to={resumeHref}>
            Continue this work
          </Link>
        ) : null}
        {resumeHref && assignment.attempt_summary === "SUBMITTED" ? (
          <Link className="btn" to={resumeHref}>
            View submitted work
          </Link>
        ) : null}
        {!assignment.currently_consumable &&
        assignment.attempt_summary === "NOT_STARTED" ? (
          <p className="muted">
            This assignment is not currently available to start.
          </p>
        ) : null}
      </div>
    </article>
  );
}
