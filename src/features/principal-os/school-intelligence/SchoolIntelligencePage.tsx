import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getPrincipalSchoolIntelligence,
  type PrincipalSchoolIntelligenceClassCardResponse,
  type PrincipalSchoolIntelligenceResponse,
  type PrincipalSchoolIntelligenceSummaryResponse,
} from "@/services/api/principalSchoolIntelligenceApi";
import { useSession } from "@/services/session/useSession";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import {
  principalErrorTitle,
  principalMessageForApiError,
} from "../principalMessages";
import {
  classActivityHighlights,
  formatActivityPresence,
  formatCoverageAmongSubmitted,
  formatCurrentFactsAsOf,
  formatProjectionCopy,
  formatTimeBasisCopy,
  GENERIC_SOURCE_PROVENANCE,
  isAuthorizedScopeEmpty,
  schoolSummaryHighlights,
} from "./schoolIntelligencePresentation";
import {
  ShowcaseBackLink,
  ShowcaseExternalHandoff,
} from "@/features/aieos360-showcase/ShowcaseContinuity";
import { buildParentShowcaseUrl } from "@/features/aieos360-showcase/showcaseCrossRoleUrls";
import "./school-intelligence.css";

export function SchoolIntelligencePage() {
  const { isConnected, isProduction } = useSession();
  const parentShowcaseHref = useMemo(() => buildParentShowcaseUrl(), []);
  const [status, setStatus] = useState<
    "no-session" | "loading" | "ready" | "error"
  >("loading");
  const [data, setData] = useState<PrincipalSchoolIntelligenceResponse | null>(
    null,
  );
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
      const { data: next } = await getPrincipalSchoolIntelligence();
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
      <article className="stack pos-page">
        <header>
          <h1>School Intelligence</h1>
        </header>
        <EmptyState
          title="Connect a development session"
          description="School Intelligence is a non-production read of current authorized facts. Connect a development session to continue."
        />
      </article>
    );
  }

  if (status === "loading") {
    return <LoadingState label="Loading School Intelligence…" />;
  }

  if (status === "error") {
    return (
      <ErrorState
        title={principalErrorTitle(error)}
        message={principalMessageForApiError(error)}
        onRetry={() => {
          void load();
        }}
      />
    );
  }

  if (!data) {
    return (
      <ErrorState
        title="School Intelligence is temporarily unavailable"
        message="School Intelligence is temporarily unavailable."
        onRetry={() => {
          void load();
        }}
      />
    );
  }

  const emptyScope = isAuthorizedScopeEmpty(data);

  return (
    <article className="stack pos-page">
      <header className="pos-page-header">
        <div>
          <h1>School Intelligence</h1>
          <p className="pos-lead">
            Leadership view of school-wide learning activity in your authorized
            class scope.
          </p>
          <p className="pos-scope">{formatCurrentFactsAsOf(data.generated_at)}</p>
          <p className="muted">
            Authorized classes: {data.summary.in_scope_class_count}
          </p>
          <ShowcaseBackLink />
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => void load()}>
          Refresh
        </button>
      </header>

      <ShowcaseExternalHandoff
        href={parentShowcaseHref}
        testId="showcase-continue-parent"
      >
        Continue showcase: Parent OS
      </ShowcaseExternalHandoff>

      {emptyScope ? (
        <EmptyState
          title="No classes are currently in your authorized School Intelligence scope."
          description="This is the current authorized result, not a loading or service failure."
        />
      ) : (
        <>
          <SchoolSummarySection summary={data.summary} />
          <ClassActivitySection classes={data.classes} />
        </>
      )}

      <DataBasisSection data={data} />
    </article>
  );
}

function SchoolSummarySection({
  summary,
}: {
  summary: PrincipalSchoolIntelligenceSummaryResponse;
}) {
  const highlights = schoolSummaryHighlights(summary);

  return (
    <section className="stack" aria-labelledby="school-summary-heading">
      <h2 id="school-summary-heading">School at a glance</h2>
      <ul className="pos-summary-grid pos-summary-grid--primary">
        {highlights.map((item) => (
          <li key={item.label} className="panel pos-stat pos-stat--highlight">
            <h3>{item.label}</h3>
            <p className="pos-stat-value">{item.value}</p>
            {item.detail ? <p className="muted pos-stat-detail">{item.detail}</p> : null}
          </li>
        ))}
      </ul>

      <details className="pos-secondary-details">
        <summary>Assignment lifecycle and supporting counts</summary>
        <ul className="pos-summary-grid pos-summary-grid--secondary">
          <SummaryStat label="Teaching assignments" value={summary.teaching_assignment_count} />
          <SummaryStat label="Active assignments" value={summary.assignment_lifecycle.active} />
          <SummaryStat label="Closed assignments" value={summary.assignment_lifecycle.closed} />
          <SummaryStat
            label="Cancelled assignments"
            value={summary.assignment_lifecycle.cancelled}
          />
          <SummaryStat
            label="Evaluations under current policy"
            value={summary.current_policy_evaluation_count}
          />
          <SummaryStat
            label="Submitted, awaiting evaluation"
            value={summary.submitted_but_not_current_policy_evaluated_count}
          />
          <SummaryStat
            label="Assignments with recorded classroom assessment"
            value={summary.assignments_with_recorded_classroom_assessment_count}
          />
          <SummaryStat
            label="Completed teaching executions"
            value={summary.completed_teaching_execution_count}
          />
        </ul>
      </details>
    </section>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <li className="panel pos-stat">
      <h3>{label}</h3>
      <p className="pos-stat-value">{value}</p>
    </li>
  );
}

function ClassActivitySection({
  classes,
}: {
  classes: PrincipalSchoolIntelligenceClassCardResponse[];
}) {
  return (
    <section className="stack" aria-labelledby="class-activity-heading">
      <h2 id="class-activity-heading">Class activity</h2>
      <ul className="pos-class-list">
        {classes.map((item) => (
          <li
            key={item.class_ref}
            className="panel pos-class-card"
            data-testid={`class-card-${item.class_ref}`}
          >
            <h3 className="pos-class-title">{item.display_label}</h3>
            <ul className="pos-class-highlights">
              {classActivityHighlights(item).map((fact) => (
                <li key={fact.label}>
                  <span className="pos-class-highlight-label">{fact.label}</span>
                  <span className="pos-class-highlight-value">{fact.value}</span>
                </li>
              ))}
            </ul>

            <details className="pos-secondary-details pos-class-details">
              <summary>More class detail</summary>
              <dl className="pos-facts">
                <Fact
                  label="Teaching assignments"
                  value={item.teaching_assignment_count}
                />
                <Fact
                  label="Closed assignments"
                  value={item.assignment_lifecycle.closed}
                />
                <Fact
                  label="Cancelled assignments"
                  value={item.assignment_lifecycle.cancelled}
                />
                <Fact
                  label="Evaluations under current policy"
                  value={item.current_policy_evaluation_count}
                />
                <Fact
                  label="Submitted, awaiting evaluation"
                  value={item.submitted_but_not_current_policy_evaluated_count}
                />
                <Fact
                  label="Submitted work records"
                  value={item.evaluation_coverage_among_submitted.submitted_count}
                />
                <Fact
                  label="Evaluated submitted records"
                  value={
                    item.evaluation_coverage_among_submitted
                      .current_policy_evaluated_count
                  }
                />
                <Fact
                  label="Assignments with recorded classroom assessment"
                  value={item.assignments_with_recorded_classroom_assessment_count}
                />
                <Fact
                  label="Completed teaching executions"
                  value={item.completed_teaching_execution_count}
                />
                <Fact
                  label="Assignment activity (raw)"
                  value={formatActivityPresence(item.has_assignment_activity)}
                />
                <Fact
                  label="Evaluation coverage (detail)"
                  value={formatCoverageAmongSubmitted(
                    item.evaluation_coverage_among_submitted,
                  )}
                />
              </dl>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function DataBasisSection({
  data,
}: {
  data: PrincipalSchoolIntelligenceResponse;
}) {
  return (
    <details className="panel pos-data-basis">
      <summary id="data-basis-heading">Technical data basis</summary>
      <div className="pos-data-basis-body">
        <p className="muted">
          Projection: {formatProjectionCopy(data.projection_mode)}. Time basis:{" "}
          {formatTimeBasisCopy(data.time_window.mode)}.
        </p>
        <p className="muted">
          Evaluation policy {data.evaluation_policy.policy_id}, version{" "}
          {data.evaluation_policy.policy_version}.
        </p>
        <p className="muted">{GENERIC_SOURCE_PROVENANCE}</p>
      </div>
    </details>
  );
}
