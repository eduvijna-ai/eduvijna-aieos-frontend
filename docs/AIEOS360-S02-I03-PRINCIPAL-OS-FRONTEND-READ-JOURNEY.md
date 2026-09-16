# AIEOS360-S02-I03 — Principal OS School Intelligence Frontend Read Journey

Governing architecture: **ADR-AIEOS-060 Frozen / Approved**.

Prerequisites: **AIEOS360-S02-I01 CLOSED**, **AIEOS360-S02-I02 CLOSED**.

This slice is frontend presentation / read consumption only.

## Contract pins

| Pin | Value |
| --- | --- |
| Frontend base | `2fe17e349bfcf772377bebd0718e1094936adaae` |
| Backend source | `e2bfce86afece6772eaf7c2f1eb18e2dd2240f1b` |
| OpenAPI SHA-256 | `BE60CC2A4612F77AB333088D264B9501B9AB842995AEC1539DA89EA0E8462B47` |
| Alembic | `a360s010004` (unchanged; Backend is read-only in I03) |

Consumed operation:

```text
GET /api/v1/principal-os/school-intelligence
operation_id: principal_os_school_intelligence_get
```

Frontend route: `/principal-os`

The Principal frontend never supplies school, class, teacher, learner,
capability, or role authority. Trusted DEV/session transport supplies bearer
and tenant only.

## Journey

Principal opens Principal OS
→ existing trusted DEV/session transport supplies bearer + tenant
→ Frontend performs the exact School Intelligence GET
→ Backend performs current HUMAN + capability + school-scope authority
→ Frontend renders only returned privacy-safe evidence-flow facts

## Summary and class-card fields

Rendered school-summary facts are Backend-provided counts only:

* `in_scope_class_count`
* `classes_with_assignment_activity_count`
* `teaching_assignment_count`
* assignment lifecycle `active` / `closed` / `cancelled`
* `learner_submission_count`
* `current_policy_evaluation_count`
* `submitted_but_not_current_policy_evaluated_count`
* `evaluation_coverage_among_submitted.submitted_count` /
  `current_policy_evaluated_count`
* `classes_with_recorded_classroom_assessment_count`
* `assignments_with_recorded_classroom_assessment_count`
* `completed_teaching_execution_count`
* `remediation_activity_count`

Authorized class cards preserve Backend order and show only:

* `display_label` (primary) and `class_ref` (secondary)
* `has_assignment_activity`
* `teaching_assignment_count`
* assignment lifecycle counts
* submission / current-policy evaluation counts
* submitted / current-policy-evaluated coverage pair
* `has_recorded_classroom_assessment`
* `assignments_with_recorded_classroom_assessment_count`
* `completed_teaching_execution_count`
* `remediation_activity_count`

No additional metrics are calculated.

## Submitted-only coverage semantics

Coverage is displayed as counts, for example:

`Current-policy evaluations: 8 of 10 submitted evidence records`

The denominator is submitted evidence only. It is not roster enrollment.
The UI does not calculate a percentage, evaluation rate, completion rate,
submission rate, or coverage score, and it does not use a percentage bar.

## Privacy, anti-surveillance, and academic-outcome boundaries

Zero learner identity: no `learner_principal_id`, learner names, learner
lists, raw answers, question IDs, objective outcomes, or drill-down to
learner evidence.

Anti-surveillance: no teacher identity, score, rank, leaderboard, comparison,
disciplinary recommendation, or private execution notes. Activity counts are
not interpreted as teacher effectiveness. Lifecycle values are not color-coded
as good/bad.

No mastery / outcome analytics: no competency attainment, predicted outcome,
school or class performance score, correctness distribution, question heatmap,
or ClassroomAssessment result level / note. Remediation is an activity count
only.

Teacher Assessment Intelligence DTOs and components are not reused.

## Error and empty-scope semantics

| Condition | UI |
| --- | --- |
| No development session | No GET; connect-a-development-session state |
| HTTP 200 with `in_scope_class_count = 0` and `classes = []` | Truthful empty authorized-scope state, not an error |
| 401 | Session is not currently accepted |
| 403 | Current Principal does not have School Intelligence access; no Teacher OS fallback |
| 503 | Temporarily unavailable because current authority or a required source could not be resolved; no all-zero dashboard |
| Network / other 5xx | Generic unavailable state |

Errors do not keep stale Principal facts on screen. Retry/Refresh repeats the
GET only.

## Freshness

The page shows `Current facts as of <generated_at>`. Provenance
(`projection_mode`, `time_window`, evaluation policy, `sources`) appears in a
subdued Data basis area. I03 has no custom date range and does not claim live
streaming semantics.

## Explicit non-implementations

* No Principal mutation API
* No AI narrative, LLM summary, agent, MCP, NATS, or Temporal
* No persistence of tokens or Principal facts
* No polling or background refresh
* Production authentication and real ERP Principal-scope adapter remain
  outside this slice
* Real-stack Backend+Frontend Playwright product harness is deferred to the
  next governed slice
