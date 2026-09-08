import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getStudentHome } from "@/services/api/studentLearningApi";
import type { StudentAssignmentResponse } from "@/services/api/studentLearningApi";
import { useSession } from "@/services/session/useSession";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { AssignmentCard } from "../assignments/AssignmentCard";
import { studentMessageForApiError } from "../studentMessages";

export function StudentHomePage() {
  const { isConnected, isProduction } = useSession();
  const [status, setStatus] = useState<
    "loading" | "ready" | "error" | "unavailable"
  >("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<StudentAssignmentResponse[]>([]);

  const load = useCallback(async () => {
    if (!isConnected && !isProduction) {
      setStatus("unavailable");
      setCount(0);
      setItems([]);
      return;
    }
    setStatus("loading");
    setErrorMessage("");
    try {
      const { data } = await getStudentHome();
      setCount(data.current_assignment_count);
      setItems(data.items);
      setStatus("ready");
    } catch (error) {
      setErrorMessage(studentMessageForApiError(error));
      setStatus("error");
    }
  }, [isConnected, isProduction]);

  useEffect(() => {
    void load();
  }, [load]);

  if (status === "unavailable") {
    return (
      <article className="stack sos-page">
        <header>
          <h1>Your work</h1>
        </header>
        <EmptyState
          title="Connect a student session"
          description="Student Home uses the AIEOS assignment list. Connect a development session to see your current work."
        />
      </article>
    );
  }

  if (status === "loading") {
    return <LoadingState label="Loading your assignments…" />;
  }

  if (status === "error") {
    return (
      <ErrorState
        title="Could not load your work"
        message={errorMessage}
        onRetry={() => {
          void load();
        }}
      />
    );
  }

  return (
    <article className="stack sos-page">
      <header>
        <h1>Your work</h1>
        <p className="sos-count">
          You have <strong>{count}</strong>{" "}
          {count === 1 ? "current assignment" : "current assignments"}.
        </p>
        <p className="muted">
          This count comes from your current class assignments. It is not the
          number of cards on this page.
        </p>
      </header>

      {items.length === 0 ? (
        <EmptyState
          title="No assignments yet"
          description="When a teacher assigns work that is available now, it will appear here."
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

      {count > items.length ? (
        <p>
          <Link className="btn btn-secondary" to="/student-os/assignments">
            See all {count} assignments
          </Link>
        </p>
      ) : (
        <p>
          <Link to="/student-os/assignments">See all assignments</Link>
        </p>
      )}
    </article>
  );
}
