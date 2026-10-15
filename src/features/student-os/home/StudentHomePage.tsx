import { useCallback, useEffect, useState } from "react";
import { ShowcaseLink } from "@/features/aieos360-showcase/ShowcaseContinuity";
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
        <header className="sos-page-header">
          <h1>Your work</h1>
        </header>
        <EmptyState
          title="Connect a student session"
          description="Sign in with a student session to see assignments from your classes."
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

  const moreOnAssignmentsPage = count > items.length;

  return (
    <article className="stack sos-page">
      <header className="sos-page-header">
        <h1>Your work</h1>
        <p className="sos-lead">
          {count === 0
            ? "You have no assignments to work on right now."
            : count === 1
              ? "You have 1 assignment to work on."
              : `You have ${count} assignments to work on.`}
        </p>
        {moreOnAssignmentsPage ? (
          <p className="muted sos-home-hint">
            A few assignments are shown below. Open the full list to see everything
            available to you.
          </p>
        ) : null}
      </header>

      {items.length === 0 ? (
        <EmptyState
          title="No assignments yet"
          description="When a teacher assigns work that is available now, it will appear here."
        />
      ) : (
        <section aria-labelledby="sos-home-current-heading">
          <h2 id="sos-home-current-heading" className="sos-section-title">
            Start here
          </h2>
          <ul className="sos-list">
            {items.map((assignment) => (
              <AssignmentCard
                key={assignment.assignment_id}
                assignment={assignment}
              />
            ))}
          </ul>
        </section>
      )}

      <p className="sos-home-footer">
        {moreOnAssignmentsPage ? (
          <ShowcaseLink className="btn btn-secondary" to="/student-os/assignments">
            See all {count} assignments
          </ShowcaseLink>
        ) : (
          <ShowcaseLink to="/student-os/assignments">See all assignments</ShowcaseLink>
        )}
      </p>
    </article>
  );
}
