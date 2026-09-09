# AIEOS360-S01-I05-E2E (cross-role real stack)

Additive Playwright lane proving one thin real vertical:

Teacher Assign → Student START/SAVE/SUBMIT → Teacher Assessment Intelligence
(GET is read-only) → deliberate Ensure → deliberate ClassroomAssessment →
Improve → remediation TeachingWork + immutable TeachingWorkRemediationOrigin.

**No `/api` Playwright mocks.** Historical `product-e2e` and
`student-product-e2e` pins are unchanged.

## Governed pins

| Artifact | SHA / value |
|----------|-------------|
| Frontend base | `fb5c0f9ae4cb45c8d7876662abdd2e852e318c56` |
| Backend | `3d25bb2d7ae3a6a95affdf075a75f20db48a6959` |
| OpenAPI authority | `7B51CE21725651B8D556B9DD6D264473DF0A2E7CAF30D722E1CC776C651FAFBB` |
| Migration head | `a360s010004` |

Historical lanes remain:

- Teacher `product-e2e` → backend `a6a1cbb5a83fc9feec6a6f5077fcc5e60f60ab24`
- Student `student-product-e2e` → backend `921d35eb08890a4e1d86cf95daf9d38cdfc4a13c`

## Topology (mandatory shared PostgreSQL)

```text
Teacher Vite :5183 ──/api──► Teacher FastAPI :8002 ──┐
                                                    ├──► PostgreSQL 18 (one DB)
Student Vite :5184 ──/api──► Student FastAPI :8003 ──┘
```

- Teacher surface: `build_development_teacher_os_app` + HUMAN synthetic teacher
- Student surface: `DevelopmentStudentPrincipalAuthenticator` + learner membership
- Student surface intentionally omits `school_context_class_reader` so Teacher
  Assessment Intelligence is not composed for harness convenience

## Ports

| Surface | Port |
|---------|------|
| Teacher backend | 8002 |
| Student backend | 8003 |
| Teacher frontend | 5183 |
| Student frontend | 5184 |
| Local PG host port | 55435 |

## Run locally

```powershell
$env:AIEOS_BACKEND_ROOT = "C:\path\to\eduvijna-aieos-backend"
# Backend HEAD must equal 3d25bb2d7ae3a6a95affdf075a75f20db48a6959

pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm test:e2e:aieos360-i05
```

## CI

Job name: `aieos360-s01-i05-e2e`

Checks out Frontend PR head + Backend exact pin, migrates to `a360s010004`,
starts Teacher + Student backends against one Postgres 18 service, starts both
Vite surfaces, runs only the I05 Playwright suite.
