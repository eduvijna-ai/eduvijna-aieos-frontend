# AIEOS360-S02-I04-E2E (Principal OS real-stack School Intelligence)

Additive Playwright lane proving the first complete **real-stack** Principal OS
School Intelligence journey against ADR-AIEOS-060, the exact governed Backend,
and one shared PostgreSQL 18 database.

Teacher Publish + Assign → Student START/SAVE/SUBMIT → no automatic evaluation
→ Teacher pre-ensure read → deliberate Ensure → HUMAN ClassroomAssessment →
Improve / immutable RemediationOrigin → Principal `/principal-os` consumes the
real `GET /api/v1/principal-os/school-intelligence`.

**No `/api` Playwright mocks.** No synthetic Principal HTTP. No injection of
Principal facts into the frontend. Historical `aieos360-s01-i05-e2e`,
`product-e2e`, and `student-product-e2e` pins are unchanged.

## ADR basis

ADR-AIEOS-060: Principal School Intelligence is a derived-on-request,
privacy-safe, count-only projection of current authorized AIEOS facts.
Coverage is submitted-evidence only. School scope is server-side current
authority. The browser supplies tenant + opaque DEV bearer only.

## Governed pins

| Artifact | SHA / value |
|----------|-------------|
| Frontend base | `4b28e6b499c4593b7d962fe1ed867c2137d43bc7` |
| Backend | `e2bfce86afece6772eaf7c2f1eb18e2dd2240f1b` |
| OpenAPI authority | `BE60CC2A4612F77AB333088D264B9501B9AB842995AEC1539DA89EA0E8462B47` |
| Migration head | `a360s010004` |

Historical lanes remain:

- I05 `aieos360-s01-i05-e2e` → backend `3d25bb2d7ae3a6a95affdf075a75f20db48a6959`, OpenAPI `7B51CE21725651B8D556B9DD6D264473DF0A2E7CAF30D722E1CC776C651FAFBB`, frontend base `fb5c0f9ae4cb45c8d7876662abdd2e852e318c56`
- Teacher `product-e2e` → backend `a6a1cbb5a83fc9feec6a6f5077fcc5e60f60ab24`
- Student `student-product-e2e` → backend `921d35eb08890a4e1d86cf95daf9d38cdfc4a13c`

I04 fails closed if the locally supplied Backend checkout is not the exact
Backend pin.

## Topology (mandatory shared PostgreSQL)

```text
Teacher Vite :5185 ──/api──► Teacher FastAPI :8004 ──┐
Student Vite :5186 ──/api──► Student FastAPI :8005 ──┼──► PostgreSQL 18 (ONE DATABASE)
Principal Vite :5187 ──/api──► Principal FastAPI :8006 ┘
```

Three identity/API surfaces share one disposable database:

- Teacher surface: `build_development_teacher_os_app` + HUMAN synthetic teacher
- Student surface: `DevelopmentStudentPrincipalAuthenticator` + learner membership; omits Teacher `school_context_class_reader`
- Principal surface: `DevelopmentPrincipalAuthenticator(PRINCIPAL_OS_HUMAN_PRINCIPAL_ID)` + DB-backed HUMAN classification + `DevelopmentSchoolIntelligencePermit` + harness-local School Context reader + `SqlAlchemySchoolIntelligenceFactsReader`

Teacher bootstrap owns PostgreSQL start (when local), identity provisioning,
migration, and fixture seeding. Student and Principal startup wait for the
shared DB report / fixture.

## Why canonical Backend development adapters were not modified

Existing semantics intentionally differ:

| Adapter | Classes |
|---------|---------|
| Teacher development assignability | `class-5a`, `class-5b` |
| Student A membership | `class-5a` |
| Canonical Principal development scope | `class-6a`, `class-6b` |

I04 must not copy `class-5a` into the canonical Principal adapter, and must not
change Teacher or Student adapter semantics. The I04 Principal surface therefore
composes a **harness-local, server-side** `I04HarnessPrincipalSchoolScopeReader`
that returns, in this order and only for the exact synthetic tenant + canonical
Principal OS HUMAN Principal:

1. `AuthorizedSchoolClassRef(class_ref="class-5a", display_label="Grade 5A")`
2. `AuthorizedSchoolClassRef(class_ref="class-5b", display_label="Grade 5B")`

This reader is NON_PRODUCTION, test/harness-only, server-side authority
composition. It is not browser data, query input, request body, Principal
selection, frontend state, ERP/SIS, or production School Context.

The Principal FastAPI surface **omits** Teacher assignability
(`school_context_class_reader`) and Student membership
(`learner_membership_reader`).

Principal identity is `PRINCIPAL_OS_HUMAN_PRINCIPAL_ID` from
`aieos.development.principal_school_context`, seeded ACTIVE / HUMAN. The opaque
bearer `aieos360-s02-i04-e2e-principal` is transport only.

## Upstream Teacher → Student → Assessment → Improve

The lane independently proves:

- Phase A: exact ContentVersion published; TeachingAssignment `class-5a` ACTIVE
- Phase B: Student A START / SAVE / SUBMIT; durable LearnerSubmission
- Phase C: SUBMIT does not auto-evaluate
- Phase D: Teacher Assessment Intelligence GET is read-only (`submitted=1`, `evaluated=0`)
- Phase E: deliberate Ensure → one current-policy evaluation
- Phase F: deliberate HUMAN ClassroomAssessment RECORDED on `class-5a` (MIXED note retained upstream only)
- Phase G: Improve creates remediation TeachingWork; immutable RemediationOrigin; no generated artifact, publish, new assignment, or TeachingExecution

Expected completed TeachingExecution count remains `0`.

## Expected School Intelligence counts

After the upstream journey, Principal current School Scope contains two classes
in server order. Only `class-5a` participated:

| Summary fact | Value |
|--------------|-------|
| `in_scope_class_count` | 2 |
| `classes_with_assignment_activity_count` | 1 |
| `teaching_assignment_count` | 1 |
| assignment lifecycle active/closed/cancelled | 1 / 0 / 0 |
| `learner_submission_count` | 1 |
| `current_policy_evaluation_count` | 1 |
| `submitted_but_not_current_policy_evaluated_count` | 0 |
| coverage submitted / current-policy evaluated | 1 / 1 |
| recorded classroom assessment class/assignment counts | 1 / 1 |
| `completed_teaching_execution_count` | 0 |
| `remediation_activity_count` | 1 |

Grade 5A carries the activity. Grade 5B is in scope with zeros. Backend class
order is preserved; the UI does not sort by activity.

`projection_mode = DERIVED_ON_REQUEST`.
`time_window.mode = CURRENT_FACTS_AS_OF_REQUEST`.
Evaluation policy `aieos.learner_assessment.deterministic` version `1`.

## Submitted-only coverage law

Coverage copy is count-only:

`Current-policy evaluations: 1 of 1 submitted evidence records`

No percentage, evaluation rate, submission rate, or progress bar.

## Privacy and teacher anti-surveillance

Principal HTTP and visible UI must not expose learner identity, response
snapshots, answers, question outcomes, teacher identity, teacher scores,
rankings, `MIXED` / `class_result_level` / ClassroomAssessment notes, mastery,
competency, prediction, risk, or performance analytics. Remediation is an
activity count only.

## Read-only Principal proof

Initial successful connection: one School Intelligence GET.
Manual Refresh: one additional GET.
No POST / PUT / PATCH / DELETE.
Direct PostgreSQL snapshots before GET, after GET, and after Refresh are
unchanged.

## No API mocks

The I04 Playwright suite installs zero `page.route` handlers for `/api`.
Browser → Vite proxy → actual FastAPI → PostgreSQL.

## Ports

| Surface | Port |
|---------|------|
| Teacher backend | 8004 |
| Student backend | 8005 |
| Principal backend | 8006 |
| Teacher frontend | 5185 |
| Student frontend | 5186 |
| Principal frontend | 5187 |
| Local PG host port | 55436 |

## Run locally

```powershell
$env:AIEOS_BACKEND_ROOT = "C:\path\to\eduvijna-aieos-backend"
# Backend HEAD must equal e2bfce86afece6772eaf7c2f1eb18e2dd2240f1b

pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm test:e2e:aieos360-s02-i04
```

## CI

Job name: `aieos360-s02-i04-e2e`

Checks out Frontend PR head + Backend exact pin, verifies Backend HEAD, computes
SHA-256 of `contracts/openapi/aieos-v1.json` (must equal `BE60CC2A…`), verifies
migration expectation `a360s010004`, starts Teacher + Student + Principal
backends against one Postgres 18 service, starts three Vite surfaces, runs only
`pnpm test:e2e:aieos360-s02-i04`.

Historical lanes remain green and are not rewritten.
