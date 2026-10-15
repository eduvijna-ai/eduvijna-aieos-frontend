import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
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
  assignedVersionExplanation,
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
import { ShowcaseBackLink } from "@/features/aieos360-showcase/ShowcaseContinuity";
import {
  isShowcaseActive,
  useWithShowcase,
  withShowcaseQuery,
} from "@/features/aieos360-showcase/showcaseContext";

export function AssignmentDetailPage() {
  const { assignmentId = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const showcaseActive = isShowcaseActive(searchParams);
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
  const resumeHandoffPath =
    assignment?.attempt_id != null
      ? `/student-os/attempts/${assignment.attempt_id}`
      : "/student-os/home";
  const resumeHref = useWithShowcase(resumeHandoffPath);
  const homeHref = useWithShowcase("/student-os/home");
  const assignmentsHref = useWithShowcase("/student-os/assignments");

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
      navigate(
        withShowcaseQuery(
          `/student-os/attempts/${data.attempt_id}`,
          showcaseActive,
        ),
      );
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
        description="Sign in with a student session to open this assignment."
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
  return (
    <article className="stack sos-page">
      <header className="sos-page-header">
        <p className="muted sos-breadcrumbs">
          <Link to={homeHref}>Home</Link> ·{" "}
          <Link to={assignmentsHref}>Assignments</Link>
        </p>
        <h1>{title}</h1>
        <ShowcaseBackLink />
        <p className="sos-card-type">{typeLabel}</p>
        <div className="sos-card-badges">
          <StatusBadge
            label={attemptProgressLabel(assignment.attempt_summary)}
            kind={assignment.attempt_summary}
          />
          <StatusBadge label={assignmentAvailabilityLabel(assignment)} />
        </div>
        <dl className="sos-timing-inline">
          <div>
            <dt>Opens</dt>
            <dd>{availableFromLabel(assignment)}</dd>
          </div>
          <div>
            <dt>Due</dt>
            <dd>{dueLabel(assignment)}</dd>
          </div>
        </dl>
        <p className="sos-version-note">{assignedVersionExplanation()}</p>
      </header>

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

      <div className="sos-actions sos-detail-actions">
        {canStart ? (
          <button
            type="button"
            className="btn"
            onClick={() => {
              void onStart();
            }}
            disabled={starting}
          >
            {starting ? "Starting…" : "Start"}
          </button>
        ) : null}
        {assignment.attempt_id != null &&
        assignment.attempt_summary === "IN_PROGRESS" ? (
          <Link className="btn" to={resumeHref}>
            Continue
          </Link>
        ) : null}
        {assignment.attempt_id != null &&
        assignment.attempt_summary === "SUBMITTED" ? (
          <Link className="btn" to={resumeHref}>
            Review submitted work
          </Link>
        ) : null}
        {!assignment.currently_consumable &&
        assignment.attempt_summary === "NOT_STARTED" ? (
          <p className="muted">
            This assignment is not open yet. Check the opening time above.
          </p>
        ) : null}
      </div>
    </article>
  );
}
