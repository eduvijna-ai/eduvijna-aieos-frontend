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
          Owner-scoped open/preview for an exact governed version.
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
        <section className="panel stack">
          <dl className="library-meta">
            <div>
              <dt>Type</dt>
              <dd>{detail.content_type}</dd>
            </div>
            <div>
              <dt>State</dt>
              <dd>{detail.stewardship_state}</dd>
            </div>
            <div>
              <dt>Published</dt>
              <dd>
                {detail.published_version_id ? "Published" : "Not published"}
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
            <pre className="library-payload" data-testid="library-version-payload">
              {JSON.stringify(version.payload, null, 2)}
            </pre>
          ) : (
            <p className="muted">No version is available to open yet.</p>
          )}
        </section>
      ) : null}
    </article>
  );
}
