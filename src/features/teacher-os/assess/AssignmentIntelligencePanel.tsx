import type { TeacherAssessmentIntelligenceResponse } from "@/services/api/assessmentIntelligenceApi";
import { EmptyState } from "@/shared/components/EmptyState";
import {
  ITEM_OUTCOME_LABELS,
  OBJECTIVE_EVIDENCE_LABELS,
  intelligenceSummaryCopy,
  learnerRows,
  needsCurrentPolicyEvaluation,
  objectiveRollupRows,
  shortPrincipalId,
  totalUnansweredAmongSubmitted,
} from "./intelligencePresentation";

type Props = {
  intelligence: TeacherAssessmentIntelligenceResponse;
  busy: boolean;
  onEvaluateSubmittedWork: () => void;
};

export function AssignmentIntelligencePanel({
  intelligence,
  busy,
  onEvaluateSubmittedWork,
}: Props) {
  const showEvaluate = needsCurrentPolicyEvaluation(intelligence);
  const unansweredTotal = totalUnansweredAmongSubmitted(
    intelligence.question_distributions,
  );
  const learners = learnerRows(intelligence.learners);
  const objectives = objectiveRollupRows(
    intelligence.objective_evidence_rollups,
  );

  return (
    <section
      className="panel assess-intelligence-panel"
      aria-labelledby="assess-intelligence-heading"
      data-testid="assignment-intelligence-panel"
    >
      <h2 id="assess-intelligence-heading">Assessment intelligence</h2>
      <p className="muted">{intelligenceSummaryCopy(intelligence)}</p>
      <p className="muted">
        Current evaluation policy:{" "}
        <code>{intelligence.evaluation_policy_id}</code> v
        {intelligence.evaluation_policy_version}. This projection is derived
        learner evidence — not teacher judgment and not Improve.
      </p>

      <dl className="work-meta">
        <div>
          <dt>Submitted learners</dt>
          <dd data-testid="intelligence-submitted-count">
            {intelligence.submitted_learner_count}
          </dd>
        </div>
        <div>
          <dt>Evaluated under current policy</dt>
          <dd data-testid="intelligence-evaluated-count">
            {intelligence.evaluated_learner_count}
          </dd>
        </div>
        <div>
          <dt>Unanswered responses (not incorrect)</dt>
          <dd data-testid="intelligence-unanswered-count">{unansweredTotal}</dd>
        </div>
        <div>
          <dt>ClassRef</dt>
          <dd>
            <code>{intelligence.class_ref}</code>
          </dd>
        </div>
        <div>
          <dt>Content / version</dt>
          <dd>
            <code>{intelligence.content_id}</code> /{" "}
            <code>{intelligence.content_version_id}</code>
          </dd>
        </div>
      </dl>

      {intelligence.submitted_learner_count === 0 ? (
        <EmptyState
          title="No submitted learners"
          description="There is no submitted learner work for this assignment yet. Assessment intelligence remains empty until learners submit."
        />
      ) : null}

      {intelligence.submitted_learner_count > 0 &&
      intelligence.evaluated_learner_count === 0 ? (
        <EmptyState
          title="Submitted work not evaluated under current policy"
          description="Submitted learners are present, but none are evaluated under the current policy. Use Evaluate submitted work deliberately — opening this page does not evaluate."
        />
      ) : null}

      {showEvaluate ? (
        <div className="detail-actions">
          <button
            type="button"
            className="btn"
            disabled={busy}
            aria-busy={busy}
            data-testid="evaluate-submitted-work"
            onClick={onEvaluateSubmittedWork}
          >
            Evaluate submitted work
          </button>
          <p className="muted">
            Explicit teacher action. Replays with the same Idempotency-Key are
            safe; the intelligence GET itself never evaluates.
          </p>
        </div>
      ) : null}

      {learners.length > 0 ? (
        <div className="assess-intelligence-block">
          <h3>Per-learner evaluation state</h3>
          <ul className="stack assess-learner-list">
            {learners.map((learner) => (
              <li key={learner.submissionId}>
                <p>
                  Learner <code>{shortPrincipalId(learner.learnerPrincipalId)}</code>
                  {" · "}
                  <span
                    data-testid={`learner-state-${learner.evaluationState}`}
                    data-currently-evaluated={
                      learner.currentlyEvaluated ? "true" : "false"
                    }
                  >
                    {learner.evaluationStateLabel} ({learner.evaluationState})
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {intelligence.question_distributions.length > 0 ? (
        <div className="assess-intelligence-block">
          <h3>Question outcomes</h3>
          <p className="muted">
            {ITEM_OUTCOME_LABELS.UNANSWERED} is never treated as incorrect or
            frequently missed.
          </p>
          <div className="assess-table-wrap">
            <table className="assess-intelligence-table">
              <thead>
                <tr>
                  <th scope="col">Question</th>
                  <th scope="col">{ITEM_OUTCOME_LABELS.CORRECT}</th>
                  <th scope="col">{ITEM_OUTCOME_LABELS.INCORRECT}</th>
                  <th scope="col">{ITEM_OUTCOME_LABELS.UNANSWERED}</th>
                  <th scope="col">
                    {ITEM_OUTCOME_LABELS.OPEN_RESPONSE_UNEVALUATED}
                  </th>
                  <th scope="col">
                    {ITEM_OUTCOME_LABELS.UNEVALUATED_POLICY_REJECT}
                  </th>
                </tr>
              </thead>
              <tbody>
                {intelligence.question_distributions.map((row) => (
                  <tr key={row.question_id}>
                    <td>
                      <code>{row.question_id}</code>
                    </td>
                    <td>{row.correct}</td>
                    <td>{row.incorrect}</td>
                    <td data-testid={`unanswered-${row.question_id}`}>
                      {row.unanswered}
                    </td>
                    <td>{row.open_response_unevaluated}</td>
                    <td>{row.unevaluated_policy_reject}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="assess-intelligence-block">
        <h3>Frequently missed (deterministic incorrect only)</h3>
        {intelligence.frequently_missed_questions.length === 0 ? (
          <p className="muted">
            No frequently missed questions. Unanswered responses are excluded
            from this list.
          </p>
        ) : (
          <ul>
            {intelligence.frequently_missed_questions.map((row) => (
              <li key={row.question_id} data-testid="frequently-missed-item">
                <code>{row.question_id}</code> — {row.incorrect_count} incorrect
              </li>
            ))}
          </ul>
        )}
      </div>

      {objectives.length > 0 ? (
        <div className="assess-intelligence-block">
          <h3>Objective evidence (submitted items)</h3>
          <ul>
            {objectives.map((row) => (
              <li key={row.objectiveId}>
                <code>{row.objectiveId}</code>
                <ul className="muted">
                  <li>
                    {OBJECTIVE_EVIDENCE_LABELS.INSUFFICIENT_EVIDENCE}:{" "}
                    {row.insufficientEvidence}
                  </li>
                  <li>
                    {OBJECTIVE_EVIDENCE_LABELS.DEMONSTRATED_ON_SUBMITTED_ITEMS}:{" "}
                    {row.demonstrated}
                  </li>
                  <li>
                    {OBJECTIVE_EVIDENCE_LABELS.MIXED_ON_SUBMITTED_ITEMS}:{" "}
                    {row.mixed}
                  </li>
                  <li>
                    {
                      OBJECTIVE_EVIDENCE_LABELS.NOT_YET_DEMONSTRATED_ON_SUBMITTED_ITEMS
                    }
                    : {row.notYet}
                  </li>
                </ul>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
