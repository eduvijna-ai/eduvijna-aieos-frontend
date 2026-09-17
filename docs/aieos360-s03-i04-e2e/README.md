# AIEOS360-S03-I04-E2E (Parent OS real-stack Parent Intelligence)

Additive Playwright lane proving the first complete **real-stack** Parent OS
Parent Intelligence journey against ADR-AIEOS-061, the exact governed Backend,
and one shared PostgreSQL 18 database.

Teacher Publish + Assign → Student START/SAVE/SUBMIT → durable Learning facts
in shared PostgreSQL → Parent `/parent-os` consumes real
`GET /api/v1/parent-os/home` and `GET /api/v1/parent-os/children/{id}`.

**No `/api` Playwright mocks.** No injected Parent JSON. No frontend-created
Parent authority. Historical `aieos360-s02-i04-e2e`, `aieos360-s01-i05-e2e`,
`product-e2e`, and `student-product-e2e` pins are unchanged.

## ADR basis

ADR-AIEOS-061: Parent Intelligence is a derived-on-request, privacy-safe,
positive-allowlist projection of current authorized AIEOS facts. Parent
Learner Access is server-side current authority. The browser supplies tenant
+ opaque DEV bearer only. The child UUID in the URL is a selector, never
authority. Unauthorized selectors are concealed as HTTP 404 /
“This child is not available.”

## Governed pins

| Artifact | SHA / value |
|----------|-------------|
| Architecture | `67f4020b78cacdf1716e18d83f4410cb16fdcb4d` |
| Frontend base | `04c2b1850732df1b8fe5de55f018edf30365181d` |
| Backend | `138f37bfa7a44c33b206c6b78118154bbb9bc8eb` |
| OpenAPI authority | `4042FB2725DA70A02A70EE09563B7698AE2E5DA82927614CAF1B5F7E6AA7C1D0` |
| Migration head | `a360s010004` |

Historical lanes remain:

- S02 `aieos360-s02-i04-e2e` → backend `e2bfce86afece6772eaf7c2f1eb18e2dd2240f1b`, OpenAPI `BE60CC2A4612F77AB333088D264B9501B9AB842995AEC1539DA89EA0E8462B47`, frontend base `4b28e6b499c4593b7d962fe1ed867c2137d43bc7`
- I05 `aieos360-s01-i05-e2e` → backend `3d25bb2d7ae3a6a95affdf075a75f20db48a6959`, OpenAPI `7B51CE21725651B8D556B9DD6D264473DF0A2E7CAF30D722E1CC776C651FAFBB`, frontend base `fb5c0f9ae4cb45c8d7876662abdd2e852e318c56`
- Teacher `product-e2e` → backend `a6a1cbb5a83fc9feec6a6f5077fcc5e60f60ab24`
- Student `student-product-e2e` → backend `921d35eb08890a4e1d86cf95daf9d38cdfc4a13c`

I04 fails closed if the locally supplied Backend checkout is not the exact
Backend pin. CI independently computes SHA-256 of
`contracts/openapi/aieos-v1.json`.

## Topology (mandatory shared PostgreSQL)

```text
Teacher Vite :5188 ──/api──► Teacher FastAPI :8007 ──┐
Student Vite :5189 ──/api──► Student FastAPI :8008 ──┼──► PostgreSQL 18 (ONE DATABASE)
Parent Vite  :5190 ──/api──► Parent FastAPI  :8009 ──┘
```

PostgreSQL host port: `55437`. Three identity/API surfaces share one
disposable database:

- Teacher surface: `build_development_teacher_os_app` + HUMAN synthetic teacher
- Student surface: `DevelopmentStudentPrincipalAuthenticator` + learner membership; omits Teacher `school_context_class_reader`
- Parent surface: `DevelopmentPrincipalAuthenticator(PARENT_OS_HUMAN_ADULT_A_ID)` + DB-backed HUMAN classification + `DevelopmentParentIntelligencePermit` + harness-local Parent Learner Access reader + `CurrentParentLearnerAccessService` + `SqlAlchemyParentIntelligenceFactsReader`

Teacher bootstrap owns PostgreSQL start (when local), identity provisioning,
migration, and fixture seeding. Student and Parent startup wait for the
shared DB report / fixture.

## Why canonical Backend Parent access was not modified

Canonical NON_PRODUCTION `_DEFAULT_ACCESS` maps:

`PARENT_OS_HUMAN_ADULT_A_ID → (LEARNER_CHILD_1_ID, LEARNER_CHILD_2_ID)`

Those synthetic children are not Student A. I04 must not rewrite canonical
development Parent authority. The Parent FastAPI surface therefore composes
`DevelopmentSchoolContextParentLearnerAccessReader` with an explicit
harness-local mapping, for the exact synthetic tenant only:

`PARENT_OS_HUMAN_ADULT_A_ID → (STUDENT_A_PRINCIPAL_ID,)`

Student B remains a valid ACTIVE HUMAN learner and is **not** mapped. Direct
Parent selector `/parent-os/children/{STUDENT_B_PRINCIPAL_ID}` must conceal
as HTTP 404.

This reader is NON_PRODUCTION, test/harness-only, server-side authority
composition. It is not browser data, query input, request body, localStorage,
frontend state, ERP/SIS, or production School Context.

The Parent FastAPI surface **omits** Teacher assignability
(`school_context_class_reader`) and Student OS membership
(`learner_membership_reader` on `create_app`). Membership is used only
inside the Parent facts reader **after** `CurrentParentLearnerAccessService`
has authorized the learner set.

Parent identity is `PARENT_OS_HUMAN_ADULT_A_ID` from
`aieos.development.parent_learner_access`, seeded ACTIVE / HUMAN. The opaque
bearer `aieos360-s03-i04-e2e-parent` is transport only.

Harness bootstrap also seeds Security Authority tenant membership for Student A
and Student B so learner-subject integrity can validate HUMAN data subjects.
That membership is not Parent Learner Access and does not authorize Student B
to Parent adult A.

## Upstream Teacher → Student

The lane independently proves:

- Phase A: exact ContentVersion published; TeachingAssignment `class-5a` ACTIVE
- Phase B: Student A START / SAVE / SUBMIT; durable LearnerAttempt + LearnerSubmission

Parent then derives `attempt_status = SUBMITTED` from those same persisted
Learning facts. I04 does not manufacture Parent status independently and does
not infer passed / failed / mastered / on track.

## Expected Parent facts

Exactly one Parent child card, corresponding server-side to Student A.
Backend order is preserved. Visible UI:

- `Child 1`
- assignment title
- assignment content type
- `Submitted`
- available-from fact
- due date or truthful `No due date`
- submitted-at fact
- current-facts timestamp / “Current facts as of this request”

Learner UUID is a selector in the HTTP payload and must not be required in
visible copy. Parent v1 has no authoritative learner-name contract.

## Concealment

Student B exists and is not Parent-authorized. Direct selector GET returns
HTTP 404. Visible copy is only “This child is not available.” No secondary
probing GET of that selector is allowed after the concealed 404.

## Read-only Parent proof

PostgreSQL snapshots before Parent Home GET, Child GET, Refresh GET, and
unauthorized Student-B GET equal snapshots afterward for content,
ContentVersion, TeachingAssignment, LearnerAttempt, LearnerSubmission,
assessment state, and security Principal records. No Parent persistence
table is created. Alembic remains `a360s010004`.

Refresh is exactly one additional GET. No POST / PUT / PATCH / DELETE.
No polling. No background refresh loop.

## No API mocks

The I04 Playwright suite installs zero `page.route` handlers for `/api`.
Browser → Vite proxy → actual FastAPI → PostgreSQL.

## Ports

| Surface | Port |
|---------|------|
| Teacher backend | 8007 |
| Student backend | 8008 |
| Parent backend | 8009 |
| Teacher frontend | 5188 |
| Student frontend | 5189 |
| Parent frontend | 5190 |
| Local PG host port | 55437 |

## Run locally

```powershell
$env:AIEOS_BACKEND_ROOT = "C:\path\to\eduvijna-aieos-backend"
# Backend HEAD must equal 138f37bfa7a44c33b206c6b78118154bbb9bc8eb

pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm test:e2e:aieos360-s03-i04
```

## CI

Job name: `aieos360-s03-i04-e2e`

Checks out Frontend PR head + Backend exact pin, verifies Backend HEAD,
computes SHA-256 of `contracts/openapi/aieos-v1.json` (must equal
`4042FB27…`), verifies migration expectation `a360s010004`, starts Teacher +
Student + Parent backends against one Postgres 18 service, starts three Vite
surfaces, runs only `pnpm test:e2e:aieos360-s03-i04`.

Historical lanes remain green and are not rewritten.
