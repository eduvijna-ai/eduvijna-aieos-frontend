import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getLearningAttempt,
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

function SubmittedAnswerList({ attempt }: { attempt: AttemptResponse }) {
  if (attempt.responses.length === 0) {
    return <p className="muted">No saved answers were recorded.</p>;
  }
  return (
    <ol className="stack" aria-label="Submitted answers">
      {attempt.responses.map((item, index) => (
        <li key={item.question_id} className="panel">
          <p>
            <strong>Answer {index + 1}.</strong>{" "}
            {item.response_kind === "TRUE_FALSE"
              ? item.boolean_value
                ? "True"
                : "False"
              : item.response_kind === "MULTIPLE_CHOICE"
                ? item.choice_value
                : item.text_value}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function AttemptPage() {
  const { attemptId = "" } = useParams();
  const { isConnected, isProduction } = useSession();
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
  }, [load]);

  const readOnly = attempt?.lifecycle_state === "SUBMITTED";
  const questions = assignment?.resource?.questions ?? [];

  async function onSave() {
    if (!attempt || !etag) return;
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
    }
  }

  async function onSubmit() {
    if (!attempt || !etag) return;
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
      if (error instanceof ApiError && error.code === "network") {
        setActionError(studentMessageForApiError(error));
      } else {
        setActionError(studentMessageForApiError(error));
        setConfirmingSubmit(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "unavailable") {
    return (
      <EmptyState
        title="Connect a student session"
        description="Attempt work loads from AIEOS."
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
      <header>
        <p className="muted">
          <Link to="/student-os/home">Home</Link> ·{" "}
          <Link
            to={`/student-os/assignments/${attempt.teaching_assignment_id}`}
          >
            Assignment
          </Link>
        </p>
        <h1>{title}</h1>
        {typeLabel ? <p className="muted">{typeLabel}</p> : null}
        <StatusBadge
          label={attemptProgressLabel(attempt.lifecycle_state)}
          kind={attempt.lifecycle_state}
        />
        {readOnly ? (
          <p>
            This work is submitted. You can read it, but you cannot change
            answers.
          </p>
        ) : (
          <p className="muted">
            Save as you go. Submit only when you are finished.
          </p>
        )}
      </header>

      {assignment?.resource ? (
        <LearnerWork resource={assignment.resource} />
      ) : readOnly ? (
        <p className="muted">
          Your submitted answers are shown below. The original assignment is no
          longer in your current list, but this submitted work remains.
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
        <p className="status-region" aria-live="polite">
          {statusMessage}
        </p>
      ) : null}

      {!readOnly ? (
        <div className="sos-actions">
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
