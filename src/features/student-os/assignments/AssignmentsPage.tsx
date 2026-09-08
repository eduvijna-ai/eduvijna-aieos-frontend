import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listStudentAssignments } from "@/services/api/studentLearningApi";
import type { StudentAssignmentResponse } from "@/services/api/studentLearningApi";
import { useSession } from "@/services/session/useSession";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { AssignmentCard } from "./AssignmentCard";
import { studentMessageForApiError } from "../studentMessages";

const PAGE_SIZE = 20;

export function AssignmentsPage() {
  const { isConnected, isProduction } = useSession();
  const [status, setStatus] = useState<
    "loading" | "ready" | "error" | "unavailable"
  >("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [items, setItems] = useState<StudentAssignmentResponse[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

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
      const { data } = await listStudentAssignments({ limit: PAGE_SIZE });
      setItems(data.items);
      setNextCursor(data.next_cursor);
      setStatus("ready");
    } catch (error) {
      setErrorMessage(studentMessageForApiError(error));
      setStatus("error");
    }
  }, [isConnected, isProduction]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setErrorMessage("");
    try {
      const { data } = await listStudentAssignments({
        limit: PAGE_SIZE,
        cursor: nextCursor,
      });
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.next_cursor);
    } catch (error) {
      setErrorMessage(studentMessageForApiError(error));
    } finally {
      setLoadingMore(false);
    }
  }

  if (status === "unavailable") {
    return (
      <article className="stack sos-page">
        <header>
          <p className="muted">
            <Link to="/student-os/home">Home</Link> · Assignments
          </p>
          <h1>Assignments</h1>
        </header>
        <EmptyState
          title="Connect a student session"
          description="Assignments load from AIEOS. Connect a development session to continue."
        />
      </article>
    );
  }

  if (status === "loading") {
    return <LoadingState label="Loading assignments…" />;
  }

  if (status === "error" && items.length === 0) {
    return (
      <ErrorState
        title="Could not load assignments"
        message={errorMessage}
        onRetry={() => {
          void loadInitial();
        }}
      />
    );
  }

  return (
    <article className="stack sos-page">
      <header>
        <p className="muted">
          <Link to="/student-os/home">Home</Link> · Assignments
        </p>
        <h1>Assignments</h1>
        <p className="muted">
          These are the assignments currently available to you. Open one to use
          the exact version your teacher assigned.
        </p>
      </header>

      {errorMessage ? (
        <p className="status-region" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          title="No assignments yet"
          description="When assigned work becomes available, it will show here."
        />
      ) : (
        <ul className="sos-list">
          {items.map((assignment) => (
            <AssignmentCard
              key={assignment.assignment_id}
              assignment={assignment}
            />
          ))}
        </ul>
      )}

      {nextCursor ? (
        <div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              void loadMore();
            }}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading more…" : "Load more"}
          </button>
        </div>
      ) : null}
    </article>
  );
}
