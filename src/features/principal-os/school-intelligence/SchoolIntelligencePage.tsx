import { useCallback, useEffect, useState } from "react";
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
  formatActivityPresence,
  formatCoverageAmongSubmitted,
  formatCurrentFactsAsOf,
  formatProjectionCopy,
  formatTimeBasisCopy,
  GENERIC_SOURCE_PROVENANCE,
  isAuthorizedScopeEmpty,
} from "./schoolIntelligencePresentation";
import "./school-intelligence.css";

export function SchoolIntelligencePage() {
  const { isConnected, isProduction } = useSession();
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
          <p className="pos-scope">{formatCurrentFactsAsOf(data.generated_at)}</p>
          <p className="muted">
            In-scope classes: {data.summary.in_scope_class_count}
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => void load()}>
          Refresh
        </button>
      </header>

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
  return (
    <section className="stack" aria-labelledby="school-summary-heading">
      <h2 id="school-summary-heading">School summary</h2>
      <ul className="pos-summary-grid">
        <SummaryStat
          label="In-scope classes"
          value={summary.in_scope_class_count}
        />
        <SummaryStat
          label="Classes with assignment activity"
          value={summary.classes_with_assignment_activity_count}
        />
        <SummaryStat
          label="Teaching assignments"
          value={summary.teaching_assignment_count}
        />
        <SummaryStat
          label="Active assignments"
          value={summary.assignment_lifecycle.active}
        />
        <SummaryStat
          label="Closed assignments"
          value={summary.assignment_lifecycle.closed}
        />
        <SummaryStat
          label="Cancelled assignments"
          value={summary.assignment_lifecycle.cancelled}
        />
        <SummaryStat
          label="Learner submissions"
          value={summary.learner_submission_count}
        />
        <SummaryStat
          label="Current-policy evaluations"
          value={summary.current_policy_evaluation_count}
        />
        <SummaryStat
          label="Submitted but not current-policy evaluated"
          value={summary.submitted_but_not_current_policy_evaluated_count}
        />
        <li className="panel pos-stat">
          <h3>Evaluation coverage among submitted</h3>
          <p className="pos-stat-value">
            {formatCoverageAmongSubmitted(
              summary.evaluation_coverage_among_submitted,
            )}
          </p>
          <p className="muted">
            Submitted: {summary.evaluation_coverage_among_submitted.submitted_count}.
            Current-policy evaluated:{" "}
            {summary.evaluation_coverage_among_submitted.current_policy_evaluated_count}.
            The denominator is submitted evidence only.
          </p>
        </li>
        <SummaryStat
          label="Classes with recorded classroom assessment"
          value={summary.classes_with_recorded_classroom_assessment_count}
        />
        <SummaryStat
          label="Assignments with recorded classroom assessment"
          value={summary.assignments_with_recorded_classroom_assessment_count}
        />
        <SummaryStat
          label="Completed teaching executions"
          value={summary.completed_teaching_execution_count}
        />
        <SummaryStat
          label="Remediation activity"
          value={summary.remediation_activity_count}
        />
      </ul>
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
      <h2 id="class-activity-heading">Authorized class activity</h2>
      <ul className="pos-class-list">
        {classes.map((item) => (
          <li
            key={item.class_ref}
            className="panel pos-class-card"
            data-testid={`class-card-${item.class_ref}`}
          >
            <h3>{item.display_label}</h3>
            <p className="muted pos-class-ref">{item.class_ref}</p>
            <dl className="pos-facts">
              <Fact
                label="Assignment activity"
                value={formatActivityPresence(item.has_assignment_activity)}
              />
              <Fact
                label="Teaching assignments"
                value={item.teaching_assignment_count}
              />
              <Fact
                label="Active assignments"
                value={item.assignment_lifecycle.active}
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
                label="Learner submissions"
                value={item.learner_submission_count}
              />
              <Fact
                label="Current-policy evaluations"
                value={item.current_policy_evaluation_count}
              />
              <Fact
                label="Submitted but not current-policy evaluated"
                value={item.submitted_but_not_current_policy_evaluated_count}
              />
              <Fact
                label="Evaluation coverage among submitted"
                value={formatCoverageAmongSubmitted(
                  item.evaluation_coverage_among_submitted,
                )}
              />
              <Fact
                label="Submitted evidence records"
                value={item.evaluation_coverage_among_submitted.submitted_count}
              />
              <Fact
                label="Current-policy evaluated records"
                value={
                  item.evaluation_coverage_among_submitted
                    .current_policy_evaluated_count
                }
              />
              <Fact
                label="Recorded classroom assessment"
                value={formatActivityPresence(
                  item.has_recorded_classroom_assessment,
                )}
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
                label="Remediation activity"
                value={item.remediation_activity_count}
              />
            </dl>
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
    <section
      className="panel pos-data-basis"
      aria-labelledby="data-basis-heading"
    >
      <h2 id="data-basis-heading">Data basis</h2>
      <p className="muted">
        Projection: {formatProjectionCopy(data.projection_mode)}. Time basis:{" "}
        {formatTimeBasisCopy(data.time_window.mode)}.
      </p>
      <p className="muted">
        Evaluation policy {data.evaluation_policy.policy_id}, version{" "}
        {data.evaluation_policy.policy_version}.
      </p>
      <p className="muted">{GENERIC_SOURCE_PROVENANCE}</p>
    </section>
  );
}
