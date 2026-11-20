import {
  type FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getContent } from "@/services/api/contentApi";
import {
  getReviewQueueDetail,
  postReviewDecision,
} from "@/services/api/reviewQueueApi";
import {
  WorksheetHintReviewPanel,
  worksheetHintReviewRequired,
} from "./WorksheetHintReviewPanel";
import type { TeacherReviewQueueDetail } from "@/services/api/generated/reviewTypes";
import type { DevSession } from "@/services/session/DevSessionConnector";
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

type LoadFence = {
  generation: number;
  session: DevSession | null;
  contentId: string;
  versionId: string;
};

type MutationFence = {
  generation: number;
  session: DevSession | null;
  contentId: string;
  versionId: string;
};

const OUT_OF_DATE_MESSAGE =
  "This page is out of date. Reload and try again.";
const STALE_DECISION_MESSAGE =
  "This resource was updated elsewhere. We've loaded the latest version. Review it and try again.";

function mutationFenceStale(
  fence: MutationFence,
  generation: number,
  session: DevSession | null,
  contentId: string,
  versionId: string,
): boolean {
  return (
    fence.generation !== generation ||
    fence.session !== session ||
    fence.contentId !== contentId ||
    fence.versionId !== versionId
  );
}

export function ReviewDetailPage() {
  const { contentId = "", versionId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isConnected, isProduction, session } = useSession();
  const sessionRef = useRef(session);
  const contentIdRef = useRef(contentId);
  const versionIdRef = useRef(versionId);
  useEffect(() => {
    sessionRef.current = session;
    contentIdRef.current = contentId;
    versionIdRef.current = versionId;
  }, [session, contentId, versionId]);

  const loadGenerationRef = useRef(0);
  const [loadGeneration, setLoadGeneration] = useState(0);
  const bumpLoadGeneration = useCallback(() => {
    loadGenerationRef.current += 1;
    setLoadGeneration(loadGenerationRef.current);
  }, []);

  const [detail, setDetail] = useState<TeacherReviewQueueDetail | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [contentEtag, setContentEtag] = useState<string | null>(null);
  const [viewFence, setViewFence] = useState<LoadFence | null>(null);
  const [attestationRecorded, setAttestationRecorded] = useState(false);
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

  const purgeReviewState = useCallback(() => {
    setDetail(null);
    setEtag(null);
    setContentEtag(null);
    setViewFence(null);
    setAttestationRecorded(false);
    setMode("idle");
    setComment("");
    setRejectConfirmed(false);
    setActionMessage("");
    setErrorMessage("");
  }, []);

  const loadFenceStale = useCallback((fence: LoadFence) => {
    return (
      fence.generation !== loadGenerationRef.current ||
      fence.session !== sessionRef.current ||
      fence.contentId !== contentIdRef.current ||
      fence.versionId !== versionIdRef.current
    );
  }, []);

  const viewAuthorized =
    viewFence !== null &&
    viewFence.generation === loadGeneration &&
    viewFence.session === session &&
    viewFence.contentId === contentId &&
    viewFence.versionId === versionId;

  const invalidateReviewSync = useCallback(() => {
    bumpLoadGeneration();
    purgeReviewState();
  }, [bumpLoadGeneration, purgeReviewState]);

  const priorIdentityRef = useRef<{
    session: DevSession | null;
    contentId: string;
    versionId: string;
  } | null>(null);
  useLayoutEffect(() => {
    const prior = priorIdentityRef.current;
    const next = { session, contentId, versionId };
    priorIdentityRef.current = next;
    if (
      prior !== null &&
      (prior.session !== session ||
        prior.contentId !== contentId ||
        prior.versionId !== versionId)
    ) {
      invalidateReviewSync();
      setStatus(isConnected || isProduction ? "loading" : "unavailable");
    }
  }, [
    session,
    contentId,
    versionId,
    invalidateReviewSync,
    isConnected,
    isProduction,
  ]);

  const loadDetail = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!contentId || !versionId) return;
      if (!isConnected && !isProduction) {
        setStatus("unavailable");
        return;
      }
      const fence: LoadFence = {
        generation: loadGenerationRef.current,
        session: sessionRef.current,
        contentId,
        versionId,
      };
      if (!options?.silent) {
        setStatus("loading");
      }
      setErrorMessage("");
      try {
        const response = await getReviewQueueDetail(contentId, versionId);
        if (loadFenceStale(fence)) return;

        const reviewDetail = response.data;
        const needsContentEtag = worksheetHintReviewRequired(
          reviewDetail.schema_id,
          reviewDetail.schema_version,
          reviewDetail.payload,
        );

        let aggregateEtag: string | null = null;
        if (needsContentEtag) {
          try {
            const contentResponse = await getContent(contentId);
            if (loadFenceStale(fence)) return;
            aggregateEtag = contentResponse.etag;
          } catch (contentError) {
            if (loadFenceStale(fence)) return;
            setErrorMessage(userMessageForApiError(contentError));
            setStatus("error");
            return;
          }
        }

        if (loadFenceStale(fence)) return;
        setDetail(reviewDetail);
        setEtag(response.etag);
        setContentEtag(aggregateEtag);
        setViewFence({ ...fence });
        setStatus("ready");
      } catch (error) {
        if (loadFenceStale(fence)) return;
        setErrorMessage(userMessageForApiError(error));
        setStatus("error");
      }
    },
    [contentId, versionId, isConnected, isProduction, loadFenceStale],
  );

  useEffect(() => {
    void loadDetail();
  }, [loadDetail, loadGeneration]);

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
    const startFence: MutationFence = {
      generation: loadGenerationRef.current,
      session: sessionRef.current,
      contentId,
      versionId,
    };
    setBusy(true);
    setActionMessage("");
    try {
      await postReviewDecision(contentId, versionId, action, body, etag);
      if (
        mutationFenceStale(
          startFence,
          loadGenerationRef.current,
          sessionRef.current,
          contentIdRef.current,
          versionIdRef.current,
        )
      ) {
        return;
      }
      returnAfterDecision(action);
    } catch (error) {
      if (
        mutationFenceStale(
          startFence,
          loadGenerationRef.current,
          sessionRef.current,
          contentIdRef.current,
          versionIdRef.current,
        )
      ) {
        return;
      }
      if (error instanceof ApiError && error.code === "precondition_failed") {
        setActionMessage(STALE_DECISION_MESSAGE);
        await loadDetail({ silent: true });
      } else {
        setActionMessage(userMessageForApiError(error));
      }
    } finally {
      if (
        !mutationFenceStale(
          startFence,
          loadGenerationRef.current,
          sessionRef.current,
          contentIdRef.current,
          versionIdRef.current,
        )
      ) {
        setBusy(false);
      }
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
        {viewAuthorized && detail ? (
          <h2 className="review-hero-resource">{detail.title}</h2>
        ) : null}
        {viewAuthorized && detail ? (
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

      {status === "ready" && viewAuthorized && detail ? (
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

          <WorksheetHintReviewPanel
            contentId={contentId}
            versionId={versionId}
            schemaId={detail.schema_id}
            schemaVersion={detail.schema_version}
            payload={detail.payload}
            contentEtag={contentEtag}
            session={session}
            resourceGeneration={loadGeneration}
            disabled={busy}
            onAttestationRecorded={() => {
              if (viewFence && !loadFenceStale(viewFence)) {
                setAttestationRecorded(true);
              }
            }}
          />

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
              {attestationRecorded
                ? " Structured hint attestation is recorded for this review session."
                : null}
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