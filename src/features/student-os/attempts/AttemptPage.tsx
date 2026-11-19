import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useParams } from "react-router-dom";
import {
  getLearningAttempt,
  getLearningAttemptLearnerHints,
  getStudentAssignment,
  saveLearningAttemptResponses,
  submitLearningAttempt,
  type AttemptResponse,
  type StudentAssignmentResponse,
} from "@/services/api/studentLearningApi";
import { useSession } from "@/services/session/useSession";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { ApiError } from "@/shared/errors/ApiError";
import {
  assignmentTitle,
  attemptProgressLabel,
  contentTypeLabel,
} from "../assignmentPresentation";
import {
  draftsFromSavedResponses,
  retainOrMintIdempotencyKey,
  revisionEtag,
  saveResponsesMaterial,
  serializeLearnerResponses,
  submitAttemptMaterial,
  type DraftAnswer,
} from "../attemptIdempotency";
import { studentMessageForApiError } from "../studentMessages";
import { LearnerWork } from "./LearnerWork";
import { ResponseEditor } from "./ResponseEditor";
import type { LearnerHintViewState } from "./QuestionLearnerHint";
import {
  devSessionPrivacyBoundaryKey,
  verifyLearnerHintForQuestion,
} from "./learnerHintPolicy";
import {
  ShowcaseBackLink,
  ShowcaseExternalHandoff,
} from "@/features/aieos360-showcase/ShowcaseContinuity";
import { buildTeacherAssessShowcaseUrl } from "@/features/aieos360-showcase/showcaseCrossRoleUrls";
import { useWithShowcase } from "@/features/aieos360-showcase/showcaseContext";

function SubmittedAnswerList({ attempt }: { attempt: AttemptResponse }) {
  if (attempt.responses.length === 0) {
    return <p className="muted">No answers were saved with this submission.</p>;
  }
  return (
    <section aria-labelledby="submitted-answers-heading">
      <h2 id="submitted-answers-heading" className="sos-section-title">
        Your submitted answers
      </h2>
      <ol className="stack sos-submitted-list">
        {attempt.responses.map((item, index) => (
          <li key={item.question_id} className="panel sos-submitted-answer">
            <p>
              <span className="sos-question-number">Answer {index + 1}</span>
              <span className="sos-submitted-value">
                {item.response_kind === "TRUE_FALSE"
                  ? item.boolean_value
                    ? "True"
                    : "False"
                  : item.response_kind === "MULTIPLE_CHOICE"
                    ? item.choice_value
                    : item.text_value}
              </span>
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function AttemptPage() {
  const { attemptId = "" } = useParams();
  const { isConnected, isProduction, session } = useSession();
  const sessionBoundaryKey = useMemo(
    () => devSessionPrivacyBoundaryKey(session),
    [session],
  );
  const [status, setStatus] = useState<
    "loading" | "ready" | "error" | "unavailable"
  >("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [attempt, setAttempt] = useState<AttemptResponse | null>(null);
  const [assignment, setAssignment] =
    useState<StudentAssignmentResponse | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, DraftAnswer>>({});
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const saveKeyRef = useRef<string | null>(null);
  const saveMaterialRef = useRef<string | null>(null);
  const submitKeyRef = useRef<string | null>(null);
  const submitMaterialRef = useRef<string | null>(null);
  const hintGuardEpochRef = useRef(0);
  const hintFetchAbortRef = useRef<AbortController | null>(null);
  const hintsMutationFenceRef = useRef(false);
  const [hintsInteractionLocked, setHintsInteractionLocked] = useState(false);
  const [hintViews, setHintViews] = useState<Record<string, LearnerHintViewState>>(
    {},
  );
  const homeHref = useWithShowcase("/student-os/home");
  const assignmentPath = `/student-os/assignments/${attempt?.teaching_assignment_id ?? ""}`;
  const assignmentHref = useWithShowcase(
    attempt?.teaching_assignment_id
      ? assignmentPath
      : "/student-os/assignments",
  );
  const teacherAssessHref = useMemo(() => {
    const assignmentId = attempt?.teaching_assignment_id;
    return assignmentId
      ? buildTeacherAssessShowcaseUrl(assignmentId)
      : null;
  }, [attempt]);

  const applyAttempt = useCallback((data: AttemptResponse, nextEtag: string | null) => {
    setAttempt(data);
    setEtag(nextEtag ?? revisionEtag(data.aggregate_revision));
    setAnswers(draftsFromSavedResponses(data.responses));
  }, []);

  const load = useCallback(async () => {
    if (!isConnected && !isProduction) {
      setStatus("unavailable");
      setAttempt(null);
      return;
    }
    setStatus("loading");
    setErrorMessage("");
    try {
      const loaded = await getLearningAttempt(attemptId);
      applyAttempt(loaded.data, loaded.etag);
      try {
        const assignmentResult = await getStudentAssignment(
          loaded.data.teaching_assignment_id,
        );
        setAssignment(assignmentResult.data);
      } catch (assignmentError) {
        if (loaded.data.lifecycle_state === "SUBMITTED") {
          setAssignment(null);
        } else {
          throw assignmentError;
        }
      }
      setStatus("ready");
    } catch (error) {
      setErrorMessage(studentMessageForApiError(error));
      setStatus("error");
    }
  }, [applyAttempt, attemptId, isConnected, isProduction]);

  useEffect(() => {
    void load();
  }, [load, sessionBoundaryKey]);

  const activeHintSessionKeyRef = useRef<string | null>(null);

  const purgeLearnerHints = useCallback(() => {
    hintGuardEpochRef.current += 1;
    hintFetchAbortRef.current?.abort();
    hintFetchAbortRef.current = null;
    activeHintSessionKeyRef.current = null;
    setHintViews({});
  }, []);

  const sessionBoundaryTrackedRef = useRef<string | null | undefined>(undefined);
  useLayoutEffect(() => {
    const prior = sessionBoundaryTrackedRef.current;
    sessionBoundaryTrackedRef.current = sessionBoundaryKey;
    if (prior !== undefined && prior !== sessionBoundaryKey) {
      purgeLearnerHints();
    }
  }, [sessionBoundaryKey, purgeLearnerHints]);

  useEffect(() => {
    return () => {
      purgeLearnerHints();
    };
  }, [purgeLearnerHints]);

  useEffect(() => {
    purgeLearnerHints();
  }, [attemptId, purgeLearnerHints]);

  const readOnly = attempt?.lifecycle_state === "SUBMITTED";
  const questions = useMemo(
    () => assignment?.resource?.questions ?? [],
    [assignment?.resource?.questions],
  );
  const questionIds = useMemo(
    () => questions.map((question) => question.id),
    [questions],
  );
  const hintsEnabled =
    attempt?.lifecycle_state === "IN_PROGRESS" &&
    !readOnly &&
    !saving &&
    !submitting &&
    !hintsInteractionLocked;

  useEffect(() => {
    if (!hintsEnabled) {
      purgeLearnerHints();
    }
  }, [hintsEnabled, purgeLearnerHints]);

  const viewHintForQuestion = useCallback(
    (questionId: string): LearnerHintViewState => {
      if (activeHintSessionKeyRef.current !== sessionBoundaryKey) {
        return { status: "idle" };
      }
      return hintViews[questionId] ?? { status: "idle" };
    },
    [hintViews, sessionBoundaryKey],
  );

  const requestLearnerHint = useCallback(async (questionId: string) => {
    if (
      !attempt ||
      !hintsEnabled ||
      hintsMutationFenceRef.current ||
      saving ||
      submitting ||
      hintsInteractionLocked
    ) {
      return;
    }
    const requestEpoch = hintGuardEpochRef.current;
    const requestSessionKey = sessionBoundaryKey;
    hintFetchAbortRef.current?.abort();
    const abort = new AbortController();
    hintFetchAbortRef.current = abort;
    activeHintSessionKeyRef.current = requestSessionKey;
    setHintViews({ [questionId]: { status: "loading" } });
    try {
      const result = await getLearningAttemptLearnerHints(attempt.attempt_id, {
        signal: abort.signal,
      });
      if (
        requestEpoch !== hintGuardEpochRef.current ||
        abort.signal.aborted
      ) {
        return;
      }
      if (requestSessionKey !== sessionBoundaryKey) {
        return;
      }
      const verified = verifyLearnerHintForQuestion(result.data as unknown, {
        attemptId: attempt.attempt_id,
        contentVersionId: attempt.content_version_id,
        questionId,
        questionIds,
      });
      if (requestEpoch !== hintGuardEpochRef.current) {
        return;
      }
      if (requestSessionKey !== sessionBoundaryKey) {
        return;
      }
      if (verified.kind === "hint") {
        activeHintSessionKeyRef.current = requestSessionKey;
        setHintViews({
          [questionId]: { status: "shown", text: verified.text },
        });
        return;
      }
      if (verified.kind === "empty") {
        activeHintSessionKeyRef.current = requestSessionKey;
        setHintViews({ [questionId]: { status: "empty" } });
        return;
      }
      activeHintSessionKeyRef.current = requestSessionKey;
      setHintViews({ [questionId]: { status: "error" } });
    } catch {
      if (abort.signal.aborted || requestEpoch !== hintGuardEpochRef.current) {
        return;
      }
      setHintViews({ [questionId]: { status: "error" } });
    } finally {
      if (hintFetchAbortRef.current === abort) {
        hintFetchAbortRef.current = null;
      }
    }
  }, [
    attempt,
    hintsEnabled,
    hintsInteractionLocked,
    questionIds,
    saving,
    sessionBoundaryKey,
    submitting,
  ]);

  async function onSave() {
    if (!attempt || !etag) return;
    hintsMutationFenceRef.current = true;
    setHintsInteractionLocked(true);
    purgeLearnerHints();
    setSaving(true);
    setActionError("");
    setStatusMessage("");
    const responses = serializeLearnerResponses(questions, answers);
    const material = saveResponsesMaterial({
      attemptId: attempt.attempt_id,
      expectedAggregateRevision: attempt.aggregate_revision,
      responses,
    });
    const key = retainOrMintIdempotencyKey(
      material,
      saveKeyRef,
      saveMaterialRef,
    );
    try {
      const saved = await saveLearningAttemptResponses(
        attempt.attempt_id,
        { responses },
        etag,
        key,
      );
      applyAttempt(saved.data, saved.etag);
      setStatusMessage("Answers saved.");
    } catch (error) {
      setActionError(studentMessageForApiError(error));
    } finally {
      setSaving(false);
      hintsMutationFenceRef.current = false;
      setHintsInteractionLocked(false);
    }
  }

  async function onSubmit() {
    if (!attempt || !etag) return;
    hintsMutationFenceRef.current = true;
    setHintsInteractionLocked(true);
    purgeLearnerHints();
    setSubmitting(true);
    setActionError("");
    setStatusMessage("");
    const material = submitAttemptMaterial({
      attemptId: attempt.attempt_id,
      expectedAggregateRevision: attempt.aggregate_revision,
    });
    const key = retainOrMintIdempotencyKey(
      material,
      submitKeyRef,
      submitMaterialRef,
    );
    try {
      const submitted = await submitLearningAttempt(
        attempt.attempt_id,
        etag,
        key,
      );
      applyAttempt(submitted.data, submitted.etag);
      setConfirmingSubmit(false);
      setStatusMessage("Work submitted.");
    } catch (error) {
      setActionError(studentMessageForApiError(error));
      if (error instanceof ApiError && error.code === "network") {
        /* keep confirm open for retry */
      } else {
        setConfirmingSubmit(false);
        void load();
      }
    } finally {
      setSubmitting(false);
      hintsMutationFenceRef.current = false;
      setHintsInteractionLocked(false);
    }
  }

  if (status === "unavailable") {
    return (
      <EmptyState
        title="Connect a student session"
        description="Sign in with a student session to open this work."
      />
    );
  }

  if (status === "loading") {
    return <LoadingState label="Loading your work…" />;
  }

  if (status === "error" || !attempt) {
    return (
      <ErrorState
        title="Could not open this work"
        message={errorMessage}
        onRetry={() => {
          void load();
        }}
      />
    );
  }

  const title = assignment
    ? assignmentTitle(assignment)
    : "Submitted work";
  const typeLabel = assignment?.resource
    ? contentTypeLabel(assignment.resource.content_type)
    : null;

  return (
    <article className="stack sos-page">
      <header className="sos-page-header">
        <p className="muted sos-breadcrumbs">
          <Link to={homeHref}>Home</Link> ·{" "}
          <Link to={assignmentHref}>Assignment</Link>
        </p>
        <h1>{title}</h1>
        <ShowcaseBackLink />
        {typeLabel ? <p className="sos-card-type">{typeLabel}</p> : null}
        {!readOnly ? (
          <StatusBadge
            label={attemptProgressLabel(attempt.lifecycle_state)}
            kind={attempt.lifecycle_state}
          />
        ) : null}
        {readOnly ? (
          <div
            className="sos-submitted-banner panel"
            role="status"
            aria-live="polite"
          >
            <p className="sos-submitted-banner-title">Submitted</p>
            <p>
              Your answers are saved and read-only. Your teacher may review them
              later — this screen does not show a grade or score.
            </p>
          </div>
        ) : (
          <p className="muted sos-attempt-hint">
            Answer each question, save when you want to keep progress, and submit
            when you are finished.
          </p>
        )}
      </header>

      {assignment?.resource ? (
        <LearnerWork resource={assignment.resource} compact />
      ) : readOnly ? (
        <p className="muted">
          The assignment is no longer on your current list, but this submission
          is still here to read.
        </p>
      ) : null}

      {questions.length > 0 ? (
        <ResponseEditor
          questions={questions}
          answers={answers}
          readOnly={readOnly}
          onChange={(questionId, answer) => {
            setAnswers((prev) => ({ ...prev, [questionId]: answer }));
          }}
          learnerHints={
            attempt?.lifecycle_state === "IN_PROGRESS" && !readOnly
              ? {
                  enabled: true,
                  interactionEnabled: hintsEnabled,
                  viewForQuestion: viewHintForQuestion,
                  onRequestHint: (questionId) => {
                    void requestLearnerHint(questionId);
                  },
                }
              : undefined
          }
        />
      ) : (
        <SubmittedAnswerList attempt={attempt} />
      )}

      {actionError ? (
        <p className="status-region" role="alert">
          {actionError}
        </p>
      ) : null}
      {statusMessage ? (
        <p className="status-region sos-save-status" aria-live="polite">
          {statusMessage}
        </p>
      ) : null}

      {!readOnly ? (
        <div className="sos-actions sos-attempt-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              void onSave();
            }}
            disabled={saving || submitting}
          >
            {saving ? "Saving…" : "Save answers"}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setConfirmingSubmit(true)}
            disabled={saving || submitting}
          >
            Submit work
          </button>
        </div>
      ) : null}

      {readOnly && teacherAssessHref ? (
        <ShowcaseExternalHandoff
          href={teacherAssessHref}
          testId="showcase-continue-teacher-assess"
        >
          Continue showcase: Teacher Assessment Intelligence for this assignment
        </ShowcaseExternalHandoff>
      ) : null}

      {confirmingSubmit ? (
        <section
          className="panel stack sos-confirm"
          role="dialog"
          aria-labelledby="submit-confirm-title"
          aria-describedby="submit-confirm-copy"
        >
          <h2 id="submit-confirm-title">Submit this work?</h2>
          <p id="submit-confirm-copy">
            After you submit, you cannot change your answers. Save first if you
            still have unsaved work.
          </p>
          <div className="sos-actions">
            <button
              type="button"
              className="btn"
              onClick={() => {
                void onSubmit();
              }}
              disabled={submitting}
            >
              {submitting ? "Submitting…" : "Yes, submit"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setConfirmingSubmit(false)}
              disabled={submitting}
            >
              Keep working
            </button>
          </div>
        </section>
      ) : null}
    </article>
  );
}
