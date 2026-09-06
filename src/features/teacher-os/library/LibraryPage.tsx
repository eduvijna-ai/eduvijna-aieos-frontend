import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listLibrary } from "@/services/api/libraryApi";
import type { TeacherLibraryItem } from "@/services/api/generated/libraryTypes";
import { useSession } from "@/services/session/useSession";
import { userMessageForApiError } from "@/shared/errors/ApiError";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { artifactViewPath } from "@/features/teacher-os/work/lifecycle";
import "./library.css";

const STEWARDSHIP_OPTIONS = [
  "",
  "DRAFT",
  "GENERATED",
  "IN_REVIEW",
  "APPROVED",
  "ARCHIVED",
] as const;

function formatUpdatedAt(value: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function openVersionId(item: TeacherLibraryItem): string | null {
  return item.published_version_id ?? item.current_version_id;
}

function openHref(item: TeacherLibraryItem): string | null {
  const versionId = openVersionId(item);
  if (!versionId) return null;
  if (item.teaching_work_id) {
    return artifactViewPath(item.teaching_work_id, {
      content_id: item.content_id,
      version_id: versionId,
    });
  }
  return `/teacher-os/library/${item.content_id}`;
}

function reviewHref(item: TeacherLibraryItem): string | null {
  if (!item.review_navigation) return null;
  return `/teacher-os/review/${item.review_navigation.content_id}/versions/${item.review_navigation.version_id}`;
}

export function LibraryPage() {
  const { isConnected, isProduction } = useSession();
  const [items, setItems] = useState<TeacherLibraryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "loading" | "ready" | "error" | "unavailable"
  >("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [contentType, setContentType] = useState("");
  const [stewardshipState, setStewardshipState] = useState("");
  const [publishedOnly, setPublishedOnly] = useState(false);

  const filters = useMemo(
    () => ({
      content_type: contentType.trim() || null,
      stewardship_state: stewardshipState || null,
      published_only: publishedOnly || null,
    }),
    [contentType, stewardshipState, publishedOnly],
  );

  const loadInitial = useCallback(async () => {
    if (!isConnected && !isProduction) {
      setStatus("unavailable");
      setItems([]);
      setNextCursor(null);
      return;
    }
    setStatus("loading");
    setErrorMessage("");
    try {
      const { data } = await listLibrary({ limit: 100, ...filters });
      setItems(data.items);
      setNextCursor(data.next_cursor);
      setStatus("ready");
    } catch (error) {
      setErrorMessage(userMessageForApiError(error));
      setStatus("error");
    }
  }, [filters, isConnected, isProduction]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setErrorMessage("");
    try {
      const { data } = await listLibrary({
        limit: 100,
        cursor: nextCursor,
        ...filters,
      });
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.next_cursor);
    } catch (error) {
      setErrorMessage(userMessageForApiError(error));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <article className="stack library-page">
      <header>
        <p className="muted">
          <Link to="/teacher-os/today">Today</Link> · Library
        </p>
        <h1>Library</h1>
        <p className="muted">
          Your reusable teaching content. Open an exact version, return to Work,
          or continue Review when an item is still in judgment.
        </p>
      </header>

      <form
        className="library-filters"
        onSubmit={(event) => {
          event.preventDefault();
          void loadInitial();
        }}
      >
        <label>
          Content type
          <input
            type="text"
            name="content_type"
            value={contentType}
            onChange={(event) => setContentType(event.target.value)}
            placeholder="e.g. worksheet"
            autoComplete="off"
          />
        </label>
        <label>
          Stewardship state
          <select
            name="stewardship_state"
            value={stewardshipState}
            onChange={(event) => setStewardshipState(event.target.value)}
          >
            {STEWARDSHIP_OPTIONS.map((option) => (
              <option key={option || "any"} value={option}>
                {option || "Any state"}
              </option>
            ))}
          </select>
        </label>
        <label className="library-filter-check">
          <input
            type="checkbox"
            checked={publishedOnly}
            onChange={(event) => setPublishedOnly(event.target.checked)}
          />
          Published only
        </label>
        <button type="submit" className="btn btn-secondary">
          Apply filters
        </button>
      </form>

      <div className="status-region" aria-live="polite">
        {status === "loading" ? (
          <LoadingState label="Loading library…" />
        ) : null}
        {status === "unavailable" ? (
          <EmptyState
            title="Session required"
            description="Connect a DEV session to load your library from the API."
          />
        ) : null}
        {status === "error" ? (
          <ErrorState
            title="Could not load library"
            message={errorMessage}
            onRetry={() => void loadInitial()}
          />
        ) : null}
        {status === "ready" && items.length === 0 ? (
          <EmptyState
            title="Library is empty"
            description="Prepare teaching work to create content you can reuse here."
            action={
              <Link className="btn" to="/teacher-os/prepare">
                Prepare
              </Link>
            }
          />
        ) : null}
      </div>

      {status === "ready" && items.length > 0 ? (
        <section aria-labelledby="library-list-heading">
          <h2 id="library-list-heading" className="sr-only">
            Library items
          </h2>
          <ul className="library-list">
            {items.map((item) => {
              const href = openHref(item);
              const review = reviewHref(item);
              return (
                <li key={item.content_id} className="panel">
                  <div className="library-item">
                    <div>
                      <h3>{item.title}</h3>
                      <dl className="library-meta">
                        <div>
                          <dt>Type</dt>
                          <dd>{item.content_type}</dd>
                        </div>
                        <div>
                          <dt>Updated</dt>
                          <dd>{formatUpdatedAt(item.updated_at)}</dd>
                        </div>
                        <div>
                          <dt>State</dt>
                          <dd>{item.stewardship_state}</dd>
                        </div>
                        <div>
                          <dt>Publication</dt>
                          <dd>
                            {item.published_version_id
                              ? "Published"
                              : "Not published"}
                          </dd>
                        </div>
                      </dl>
                    </div>
                    <div className="library-actions">
                      {href ? (
                        <Link className="btn" to={href}>
                          Open
                        </Link>
                      ) : null}
                      {item.teaching_work_id ? (
                        <Link
                          className="btn btn-secondary"
                          to={`/teacher-os/work/${item.teaching_work_id}`}
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
                  </div>
                </li>
              );
            })}
          </ul>
          {nextCursor ? (
            <div className="library-load-more">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void loadMore()}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          ) : null}
          {errorMessage && status === "ready" ? (
            <p className="muted" role="alert">
              {errorMessage}
            </p>
          ) : null}
        </section>
      ) : null}
    </article>
  );
}
