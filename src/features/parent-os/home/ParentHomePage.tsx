import { Link } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import {
  getParentOsHome,
  type ParentIntelligenceResponse,
} from "@/services/api/parentIntelligenceApi";
import { useSession } from "@/services/session/useSession";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { ParentAssignmentList } from "../ParentAssignmentList";
import { parentErrorTitle, parentMessageForApiError } from "../parentMessages";
import {
  assignmentsOf,
  childOrdinalLabel,
  childrenOf,
  formatCurrentFactsAsOf,
  formatTimeBasisCopy,
} from "../parentPresentation";
import "../parent-os.css";

export function ParentHomePage() {
  const { isConnected, isProduction } = useSession();
  const [status, setStatus] = useState<
    "no-session" | "loading" | "ready" | "error"
  >("loading");
  const [data, setData] = useState<ParentIntelligenceResponse | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
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
      const { data: next } = await getParentOsHome();
      setData(next);
      setStatus("ready");
    } catch (cause) {
      setData(null);
      setError(cause);
      setStatus("error");
    }
  }, [isConnected, isProduction]);

  useEffect(() => {
    void load();
  }, [load]);

  if (status === "no-session") {
    return (
      <article className="stack parent-os-page">
        <header>
          <h1>Parent home</h1>
        </header>
        <EmptyState
          title="Connect a development session"
          description="Parent OS is a non-production read of current authorized facts. Connect a development session to continue."
        />
      </article>
    );
  }

  if (status === "loading") {
    return <LoadingState label="Loading Parent facts…" />;
  }

  if (status === "error") {
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

  const children = childrenOf(data);

  return (
    <article className="stack parent-os-page">
      <header className="parent-os-page-header">
        <div>
          <h1>Parent home</h1>
          <p className="parent-os-basis">{formatCurrentFactsAsOf(data.generated_at)}</p>
          <p className="muted">{formatTimeBasisCopy()}</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => void load()}>
          Refresh
        </button>
      </header>

      {children.length === 0 ? (
        <EmptyState
          title="No children are currently available in your Parent view."
          description="This is the current authorized result, not a service failure."
        />
      ) : (
        <section className="stack" aria-labelledby="parent-children-heading">
          <h2 id="parent-children-heading">Children currently available</h2>
          <ul className="parent-os-child-list">
            {children.map((child, index) => (
              <li
                key={child.learner_principal_id}
                className="panel parent-os-child-card"
                data-testid={`parent-child-card-${index}`}
              >
                <h2>{childOrdinalLabel(index)}</h2>
                <p className="muted">
                  Presentation order only. This is not an authoritative name.
                </p>
                <ParentAssignmentList assignments={assignmentsOf(child)} />
                <Link
                  className="btn parent-os-child-link"
                  to={`/parent-os/children/${encodeURIComponent(child.learner_principal_id)}`}
                >
                  View current facts for {childOrdinalLabel(index)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
