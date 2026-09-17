# AIEOS360-S03-I03 — Parent OS frontend read journey

Governing architecture: **ADR-AIEOS-061 Frozen / Approved v1.0.1**.

I04 (real-stack Parent E2E) is **not authorized** in this slice.

## Governed pins

| Authority | Value |
| --- | --- |
| Architecture origin/main | `67f4020b78cacdf1716e18d83f4410cb16fdcb4d` |
| Backend origin/main | `138f37bfa7a44c33b206c6b78118154bbb9bc8eb` |
| Frontend base | `1b4263d0668f66d84cc261c79a2e81883375219e` |
| Authoritative OpenAPI SHA-256 | `4042FB2725DA70A02A70EE09563B7698AE2E5DA82927614CAF1B5F7E6AA7C1D0` |
| Alembic head | `a360s010004` |

Frontend consumes Backend facts only. It does not create Parent authority, infer
relationships, invent academic conclusions, or mutate Parent state.

## Exact Backend operations

| Journey | Method | Path | operationId |
| --- | --- | --- | --- |
| Parent home | GET | `/api/v1/parent-os/home` | `parent_os_home_get` |
| Child selector | GET | `/api/v1/parent-os/children/{learner_principal_id}` | `parent_os_child_get` |

No POST, PUT, PATCH, or DELETE. The frontend never submits capability, role,
school/class scope, teacher identity, or adult→learner relationship proof.
Trusted transport supplies only the existing authenticated session/bearer and
tenant context. The learner UUID in the child path is a **selector only**. It
is never authority.

## Parent home journey

`/parent-os` performs only `GET /api/v1/parent-os/home`.

The page renders:

- current-facts timestamp from `generated_at`
- human-facing basis: “Current facts as of this request”
- Backend `children[]` in Backend order
- each child's authorized assignments

The UI does not independently discover or list learners.

Backend currently returns `learner_principal_id` without an authoritative child
name. Parent OS therefore uses ephemeral order labels (“Child 1”, “Child 2”).
Those labels are presentation order only. They are not identity, family, or
access authority. Names are not resolved from another endpoint or roster.

## Child selector journey

Selecting a child card navigates to `/parent-os/children/:learnerPrincipalId`
and consumes exactly `GET /api/v1/parent-os/children/{learner_principal_id}`.

Home-page data is not reused as authority. The detail GET revalidates current
authority on Backend. A direct URL is a selector request; all access decisions
remain server-side.

## Current-authority semantics

Every successful GET is current facts as of that request. Refresh/Retry repeats
the same GET only. There is no background refresh, polling, cache, or Parent
payload persistence (`localStorage`, `sessionStorage`, IndexedDB).

## 404 concealment

Backend 404 on the child selector shows one generic state:

“This child is not available.”

The UI does not distinguish unknown, revoked, other-parent, other-class,
other-school, other-tenant, formerly authorized, or invented UUID cases. It
does not issue secondary probing requests after 404.

## Zero-child semantics

HTTP 200 with `children = []` is a successful authorized result. Parent OS
renders:

“No children are currently available in your Parent view.”

This is not a system error, missing configuration, “no children exist”, or a
family/custody conclusion.

## Allowed fields

Assignment presentation uses only the Parent DTO vocabulary:

- `assignment_id`
- `title`
- `content_type`
- `available_from`
- `due_at`
- `attempt_status`
- `submitted_at`

Human-readable statuses:

- `NOT_STARTED` → Not started
- `IN_PROGRESS` → In progress
- `SUBMITTED` → Submitted

`due_at = null` renders as “No due date”. `submitted_at` is shown only according
to the Backend submitted fact.

## Forbidden fields / privacy boundary

Parent UI must not expose or derive other learner identities, class roster,
class counts, teacher identity or notes, Teacher Memory, private execution
notes, raw attempt responses, answers, question IDs, answer keys, submission
snapshots, content payload, `content_id`, `content_version_id`, `class_ref`,
`attempt_id`, `submission_id`, `evaluation_id`, scores, marks, grades,
correct/incorrect items, objective evidence, mastery, competency, learner
level, diagnosis, predicted performance, risk, ranking, peer comparison,
“behind peers”, Principal School Intelligence metrics, Teacher Assessment
Intelligence `learners[]`, or Improve/Remediation internal content.

The UI does not calculate percentages, grades, performance scores, or risk
summaries from assignment lifecycle counts.

## No evaluation / mastery

`EVALUATION_EXISTENCE` remains NO for this journey. Parent OS does not query
or present evaluation, mastery, or correctness.

## No AI / mutations / workflow

I03 does not add LLM calls, Parent Agent, generated narrative, MCP, NATS,
Temporal, polling workers, notifications, Parent summary authoring, teacher
comments, acknowledgement, or intervention request. Authoritative fact is not
generated explanation.

## Failure semantics

| Condition | UI |
| --- | --- |
| No development session | existing connect/session state; **no Parent GET** |
| 401 | session not accepted; Parent facts cleared |
| 403 | current adult does not have Parent Intelligence access; no Teacher/Principal/Student fallback; facts cleared |
| 404 child selector | generic concealment only |
| 503 | “Parent information is temporarily unavailable”; not empty children; no stale successful facts |
| Network / unexpected 5xx | generic unavailable |

## I04 deferred

Real-stack Parent Playwright E2E is **not started**.
