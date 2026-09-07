import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getLibraryItem, getLibraryVersion } from "@/services/api/libraryApi";
import type {
  TeacherLibraryDetail,
  TeacherLibraryVersion,
} from "@/services/api/generated/libraryTypes";
import { useSession } from "@/services/session/useSession";
import { userMessageForApiError } from "@/shared/errors/ApiError";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { ArtifactRenderer } from "@/features/teacher-os/artifacts/ArtifactRenderer";
import {
  artifactTypeLabel,
  publicationLabel,
  stewardshipLabel,
} from "@/features/teacher-os/artifacts/artifactLabels";
import { artifactViewPath } from "@/features/teacher-os/work/lifecycle";
import "./library.css";

/**
 * Owner-scoped Library detail / open surface.
 * Used when teaching_work_id is absent so FE does not call tenant-wide content GET.
 */
export function LibraryDetailPage() {
  const { contentId = "" } = useParams();
  const { isConnected, isProduction } = useSession();
  const [detail, setDetail] = useState<TeacherLibraryDetail | null>(null);
  const [version, setVersion] = useState<TeacherLibraryVersion | null>(null);
  const [status, setStatus] = useState<
    "loading" | "ready" | "error" | "unavailable"
  >("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async () => {
    if (!isConnected && !isProduction) {
      setStatus("unavailable");
      return;
    }
    if (!contentId) {
      setStatus("error");
      setErrorMessage("Missing content id.");
      return;
    }
    setStatus("loading");
    setErrorMessage("");
    try {
      const { data } = await getLibraryItem(contentId);
      setDetail(data);
      const versionId = data.published_version_id ?? data.current_version_id;
      if (versionId) {
        const opened = await getLibraryVersion(contentId, versionId);
        setVersion(opened.data);
      } else {
        setVersion(null);
      }
      setStatus("ready");
    } catch (error) {
      setErrorMessage(userMessageForApiError(error));
      setStatus("error");
    }
  }, [contentId, isConnected, isProduction]);

  useEffect(() => {
    void load();
  }, [load]);

  const review =
    detail?.review_navigation != null
      ? `/teacher-os/review/${detail.review_navigation.content_id}/versions/${detail.review_navigation.version_id}`
      : null;
  const artifact =
    detail?.teaching_work_id && version
      ? artifactViewPath(detail.teaching_work_id, {
          content_id: detail.content_id,
          version_id: version.version_id,
        })
      : null;

  return (
    <article className="stack library-page">
      <header>
        <p className="muted">
          <Link to="/teacher-os/library">Library</Link> · Item
        </p>
        <h1>{detail?.title ?? "Library item"}</h1>
        <p className="muted">
          Preview the published resource and use it in your teaching workflow.
        </p>
      </header>

      <div className="status-region" aria-live="polite">
        {status === "loading" ? (
          <LoadingState label="Loading library item…" />
        ) : null}
        {status === "unavailable" ? (
          <EmptyState
            title="Session required"
            description="Connect a DEV session to open this library item."
          />
        ) : null}
        {status === "error" ? (
          <ErrorState
            title="Could not open library item"
            message={errorMessage}
            onRetry={() => void load()}
          />
        ) : null}
      </div>

      {status === "ready" && detail ? (
        <section className="panel stack library-detail">
          <dl className="library-meta">
            <div>
              <dt>Type</dt>
              <dd>
                <span className="library-chip">
                  {artifactTypeLabel(detail.content_type)}
                </span>
              </dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <span className="library-chip">
                  {stewardshipLabel(detail.stewardship_state)}
                </span>
              </dd>
            </div>
            <div>
              <dt>Publication</dt>
              <dd>
                <span className="library-chip">
                  {publicationLabel(detail.published_version_id)}
                </span>
              </dd>
            </div>
          </dl>
          <div className="library-actions">
            {artifact ? (
              <Link className="btn" to={artifact}>
                Open in Work
              </Link>
            ) : null}
            {detail.teaching_work_id ? (
              <Link
                className="btn btn-secondary"
                to={`/teacher-os/work/${detail.teaching_work_id}`}
              >
                Work
              </Link>
            ) : null}
            {review ? (
              <Link className="btn btn-secondary" to={review}>
                Review
              </Link>
            ) : null}
          </div>
          {version ? (
            <div className="library-artifact" data-testid="library-artifact">
              <ArtifactRenderer
                contentType={detail.content_type}
                payload={version.payload}
              />
            </div>
          ) : (
            <p className="muted">No version is available to open yet.</p>
          )}
        </section>
      ) : null}
    </article>
  );
}
