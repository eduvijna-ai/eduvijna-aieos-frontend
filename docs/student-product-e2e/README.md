# Student Product E2E (AIEOS360-S01-I04R1)

Additive real-stack Playwright lane proving Student Home → assignment list /
detail → START → SAVE → RESUME → SUBMIT against the **merged I03** backend.
**No `/api` Playwright mocks.** Teacher OS `product-e2e` is unchanged and
remains pinned to the older Teacher OS backend.

## Governed pins

| Artifact | SHA / value |
|----------|-------------|
| Backend (merged I03) | `921d35eb08890a4e1d86cf95daf9d38cdfc4a13c` |
| OpenAPI authority | `4691D6BADA2157D436435BB5CCDD6797EA670D1A87543D42CA39A478F940F330` |
| Migration head | `a360s010002` |

Teacher `product-e2e` continues to use backend
`a6a1cbb5a83fc9feec6a6f5077fcc5e60f60ab24` / migration `tosd100001`.

## Non-production boundary

- `scripts/student-product-e2e/serve_development_app.py` wires
  `DevelopmentStudentPrincipalAuthenticator`, learner membership, and
  student learning UoW (development adapters only)
- Disposable file-gated membership reader for historical SUBMITTED proof
- Synthetic student bearer `dev-student-a` (never a Principal UUID)
- Disposable PostgreSQL **18** only
- Frontend does **not** call PostgreSQL or PostgREST directly
- Assessment Intelligence is **not** started

## Prerequisites (local)

1. **Node 24** + **pnpm 11**
2. **Python 3.14** + **uv**
3. **Docker** (local disposable PG18) unless CI-style DB URLs are set
4. Backend checkout at pin `921d35eb…` via `AIEOS_BACKEND_ROOT`

## Run locally

```powershell
# From eduvijna-aieos-frontend
$env:AIEOS_BACKEND_ROOT = "C:\path\to\eduvijna-aieos-backend"

pnpm install --frozen-lockfile
pnpm exec playwright install chromium

pnpm test:e2e:student-product
```

| Variable | Default | Purpose |
|----------|---------|---------|
| `AIEOS_BACKEND_ROOT` | *(required)* | Backend at I03 pin SHA |
| `PLAYWRIGHT_PORT` | `5182` | Vite port (isolated from Teacher 5181) |
| `STUDENT_PRODUCT_E2E_BACKEND_PORT` | `8001` | API port (isolated from Teacher 8000) |
| `AIEOS_TEST_PG_PORT` | `55434` | PG host port (isolated from Teacher 55433) |

## Architecture

```text
Chromium → Vite (5182) → /api proxy → uvicorn student development app (8001)
                                              ↓
                                    PostgreSQL 18 (disposable)
```

Seed uses backend test helpers only:
`ensure_synthetic_student_principals`, `seed_published_learner_content`,
`create_learner_assignment`.

Scenario marker:

`[AIEOS360-S01-I04R1:student-product-e2e] Student real-stack journey`

## CI

Job name: `student-product-e2e`

Checks backend checkout SHA = `921d35eb…`, migrates to `a360s010002`, then
runs the Playwright scenario. Existing `product-e2e` remains a separate job.
