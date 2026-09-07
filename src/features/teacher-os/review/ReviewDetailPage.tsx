import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  getReviewQueueDetail,
  postReviewDecision,
} from "@/services/api/reviewQueueApi";
import type { TeacherReviewQueueDetail } from "@/services/api/generated/reviewTypes";
import { useSession } from "@/services/session/useSession";
import { ApiError, userMessageForApiError } from "@/shared/errors/ApiError";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { ArtifactRenderer } from "@/features/teacher-os/artifacts/ArtifactRenderer";
import { canonicalContentType } from "@/features/teacher-os/artifacts/artifactLabels";
import { safeWorkReturnPath } from "@/features/teacher-os/work/lifecycle";
import { formatSubmittedDay } from "@/shared/time/teacherDates";
import {
  originPreparedLabel,
  reviewArtifactTypeLabel,
  reviewPageTitle,
  reviewStatusLabel,
} from "./reviewPresentation";
import "./review.css";

type ActionMode = "idle" | "request-changes" | "reject";

const OUT_OF_DATE_MESSAGE =
  "This page is out of date. Reload and try again.";
const STALE_DECISION_MESSAGE =
  "This resource was updated elsewhere. We've loaded the latest version. Review it and try again.";

export function ReviewDetailPage() {
  const { contentId = "", versionId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isConnected, isProduction } = useSession();
  const [detail, setDetail] = useState<TeacherReviewQueueDetail | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "loading" | "ready" | "error" | "unavailable"
  >("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<ActionMode>("idle");
  const [comment, setComment] = useState("");
  const [rejectConfirmed, setRejectConfirmed] = useState(false);

  const workReturnPath = safeWorkReturnPath(searchParams.get("fromWork"));

  const loadDetail = useCallback(async (options?: { silent?: boolean }) => {
    if (!contentId || !versionId) return;
    if (!isConnected && !isProduction) {
      setStatus("unavailable");
      return;
    }
    if (!options?.silent) {
      setStatus("loading");
    }
    setErrorMessage("");
    try {
      const response = await getReviewQueueDetail(contentId, versionId);
      setDetail(response.data);
      setEtag(response.etag);
      setStatus("ready");
    } catch (error) {
      setErrorMessage(userMessageForApiError(error));
      setStatus("error");
    }
  }, [contentId, versionId, isConnected, isProduction]);

  useEffect(() => {
    setActionMessage("");
  }, [contentId, versionId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  function returnAfterDecision(action: "approve" | "request-changes" | "reject") {
    if (workReturnPath) {
      setActionMessage(
        action === "approve"
          ? "Approved. Returning to preparation…"
          : action === "request-changes"
            ? "Changes requested. Returning to preparation…"
            : "Rejected. Returning to preparation…",
      );
      navigate(workReturnPath);
      return;
    }
    setActionMessage(
      action === "approve"
        ? "Approved. Returning to queue…"
        : action === "request-changes"
          ? "Changes requested."
          : "Rejected.",
    );
    navigate("/teacher-os/review");
  }

  async function runDecision(
    action: "approve" | "request-changes" | "reject",
    body: { comment?: string | null },
  ) {
    if (!etag) {
      setActionMessage(OUT_OF_DATE_MESSAGE);
      return;
    }
    setBusy(true);
    setActionMessage("");
    try {
      await postReviewDecision(contentId, versionId, action, body, etag);
      returnAfterDecision(action);
    } catch (error) {
      if (error instanceof ApiError && error.code === "precondition_failed") {
        setActionMessage(STALE_DECISION_MESSAGE);
        await loadDetail({ silent: true });
      } else {
        setActionMessage(userMessageForApiError(error));
      }
    } finally {
      setBusy(false);
    }
  }

  function onApprove() {
    void runDecision("approve", {});
  }

  function onRequestChanges(event: FormEvent) {
    event.preventDefault();
    const trimmed = comment.trim();
    if (!trimmed) {
      setActionMessage("A comment is required to request changes.");
      return;
    }
    void runDecision("request-changes", { comment: trimmed });
  }

  function onReject(event: FormEvent) {
    event.preventDefault();
    if (!rejectConfirmed) {
      setActionMessage("Confirm rejection before submitting.");
      return;
    }
    const trimmed = comment.trim();
    void runDecision("reject", {
      comment: trimmed ? trimmed : null,
    });
  }

  const typeLabel = detail ? reviewArtifactTypeLabel(detail.content_type) : null;
  const pageTitle = detail
    ? reviewPageTitle(detail.content_type)
    : "Review resource";
  const statusLabel = detail
    ? reviewStatusLabel(detail.artifact_status)
    : null;
  const origin = detail ? originPreparedLabel(detail.origin) : "";
  const rendererType = detail
    ? canonicalContentType(detail.content_type) || detail.content_type
    : "";

  return (
    <article className="stack review-detail-page">
      <header className="review-hero">
        <p className="muted">
          {workReturnPath ? (
            <>
              <Link to={workReturnPath}>Preparation</Link> · Review
            </>
          ) : (
            <>
              <Link to="/teacher-os/review">Review Queue</Link> · Review
            </>
          )}
        </p>
        <div className="review-hero-title-row">
          <h1>{pageTitle}</h1>
          {statusLabel ? <StatusBadge label={statusLabel} /> : null}
        </div>
        {detail ? (
          <h2 className="review-hero-resource">{detail.title}</h2>
        ) : null}
        {detail ? (
          <p className="muted review-hero-meta">
            {origin ? `${origin} · ` : null}
            Version {detail.version_number}
            {detail.submitted_at
              ? ` · Submitted ${formatSubmittedDay(detail.submitted_at)}`
              : null}
          </p>
        ) : null}
      </header>

      <div className="status-region" aria-live="polite">
        {status === "loading" ? <LoadingState label="Loading resource…" /> : null}
        {status === "unavailable" ? (
          <EmptyState
            title="Session required"
            description="Connect a DEV session to load this review resource."
          />
        ) : null}
        {status === "error" ? (
          <ErrorState
            title="Could not load resource"
            message={errorMessage}
            onRetry={() => void loadDetail()}
          />
        ) : null}
      </div>

      {status === "ready" && detail ? (
        <>
          <section
            className="panel review-document"
            aria-labelledby="review-document-heading"
          >
            <h2 id="review-document-heading" className="sr-only">
              {typeLabel ?? "Resource"}
            </h2>
            <ArtifactRenderer
              contentType={rendererType}
              payload={detail.payload}
            />
          </section>

          <section
            className="panel review-decision"
            aria-labelledby="actions-heading"
          >
            <h2 id="actions-heading">Your decision</h2>
            <p>
              Review the resource first, then choose what happens next.
            </p>
            <p className="muted">
              Approval confirms this version is ready. Publishing remains a
              separate step.
            </p>
            <div className="review-actions">
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={onApprove}
              >
                Approve
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => {
                  setMode("request-changes");
                  setRejectConfirmed(false);
                  setComment("");
                }}
              >
                Request changes
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={busy}
                onClick={() => {
                  setMode("reject");
                  setRejectConfirmed(false);
                  setComment("");
                }}
              >
                Reject
              </button>
            </div>

            {mode === "request-changes" ? (
              <form className="review-action-form" onSubmit={onRequestChanges}>
                <label htmlFor="request-changes-comment">
                  What should be changed?
                  <span id="request-changes-hint" className="muted review-field-hint">
                    Describe what you want revised before approving this resource.
                  </span>
                  <textarea
                    id="request-changes-comment"
                    name="comment"
                    required
                    rows={4}
                    value={comment}
                    aria-describedby="request-changes-hint"
                    onChange={(e) => setComment(e.target.value)}
                  />
                </label>
                <button type="submit" className="btn" disabled={busy}>
                  Send change request
                </button>
              </form>
            ) : null}

            {mode === "reject" ? (
              <form className="review-action-form" onSubmit={onReject}>
                <p className="review-reject-lead">Reject this resource</p>
                <label className="review-confirm">
                  <input
                    type="checkbox"
                    checked={rejectConfirmed}
                    onChange={(e) => setRejectConfirmed(e.target.checked)}
                  />
                  I understand this resource will be rejected.
                </label>
                <label htmlFor="reject-comment">
                  Comment (optional)
                  <textarea
                    id="reject-comment"
                    name="comment"
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </label>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={busy || !rejectConfirmed}
                >
                  Reject this resource
                </button>
              </form>
            ) : null}

            <p className="status-region" aria-live="assertive" role="status">
              {actionMessage}
            </p>
          </section>
        </>
      ) : null}
    </article>
  );
}
