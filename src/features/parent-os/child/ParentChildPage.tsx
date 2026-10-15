import { useParams } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import {
  getParentOsChild,
  type ParentIntelligenceResponse,
} from "@/services/api/parentIntelligenceApi";
import { useSession } from "@/services/session/useSession";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { ParentAssignmentList } from "../ParentAssignmentList";
import {
  isParentChildConcealment,
  parentErrorTitle,
  parentMessageForApiError,
} from "../parentMessages";
import {
  assignmentsOf,
  childrenOf,
  formatAssignmentStatusSummary,
  formatCurrentFactsAsOf,
  formatTimeBasisCopy,
  summarizeAssignmentStatuses,
} from "../parentPresentation";
import {
  ShowcaseBackLink,
  ShowcaseLink,
} from "@/features/aieos360-showcase/ShowcaseContinuity";
import "../parent-os.css";

export function ParentChildPage() {
  const { learnerPrincipalId } = useParams<{ learnerPrincipalId: string }>();
  const { isConnected, isProduction } = useSession();
  const [status, setStatus] = useState<
    "no-session" | "loading" | "ready" | "error"
  >("loading");
  const [data, setData] = useState<ParentIntelligenceResponse | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    if (!learnerPrincipalId) {
      setData(null);
      setError(null);
      setStatus("error");
      return;
    }
    if (!isConnected && !isProduction) {
      setData(null);
      setError(null);
      setStatus("no-session");
      return;
    }
    setStatus("loading");
    setError(null);
    setData(null);
    try {
      const { data: next } = await getParentOsChild(learnerPrincipalId);
      setData(next);
      setStatus("ready");
    } catch (cause) {
      setData(null);
      setError(cause);
      setStatus("error");
    }
  }, [isConnected, isProduction, learnerPrincipalId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (status === "no-session") {
    return (
      <article className="stack parent-os-page">
        <header>
          <h1>Child activity</h1>
        </header>
        <EmptyState
          title="Connect a development session"
          description="Parent OS is a non-production read of current authorized facts. Connect a development session to continue."
        />
      </article>
    );
  }

  if (status === "loading") {
    return <LoadingState label="Loading assignments…" />;
  }

  if (status === "error") {
    if (isParentChildConcealment(error)) {
      return (
        <article className="stack parent-os-page">
          <header>
            <h1>Child activity</h1>
          </header>
          <EmptyState
            title="This child is not available."
            action={
              <ShowcaseLink className="btn btn-secondary" to="/parent-os">
                Back to family home
              </ShowcaseLink>
            }
          />
        </article>
      );
    }
    return (
      <ErrorState
        title={parentErrorTitle(error)}
        message={parentMessageForApiError(error)}
        onRetry={() => {
          void load();
        }}
      />
    );
  }

  if (!data) {
    return (
      <ErrorState
        title="Parent information is temporarily unavailable"
        message="Parent information is temporarily unavailable."
        onRetry={() => {
          void load();
        }}
      />
    );
  }

  const child = childrenOf(data)[0];
  const assignments = child ? assignmentsOf(child) : [];
  const summary = summarizeAssignmentStatuses(assignments);

  return (
    <article className="stack parent-os-page">
      <header className="parent-os-page-header">
        <div>
          <h1>Child activity</h1>
          <ShowcaseBackLink />
          <p className="parent-os-lead">{formatAssignmentStatusSummary(summary)}</p>
          <p className="parent-os-basis">{formatCurrentFactsAsOf(data.generated_at)}</p>
          <p className="muted">{formatTimeBasisCopy()}</p>
        </div>
        <div className="parent-os-actions">
          <ShowcaseLink className="btn btn-secondary" to="/parent-os">
            Back to family home
          </ShowcaseLink>
          <button type="button" className="btn btn-secondary" onClick={() => void load()}>
            Refresh
          </button>
        </div>
      </header>
      {child ? (
        <section className="stack" aria-labelledby="parent-child-heading">
          <h2 id="parent-child-heading">Current assignments</h2>
          <ParentAssignmentList assignments={assignments} />
        </section>
      ) : (
        <EmptyState
          title="No children are currently available in your Parent view."
          description="This is the current authorized result, not a service failure."
        />
      )}
    </article>
  );
}
