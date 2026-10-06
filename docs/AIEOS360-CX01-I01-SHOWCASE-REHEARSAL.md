# AIEOS360-CX01-I01 — Client Showcase Rehearsal Environment

> **NON_PRODUCTION / DISPOSABLE / SYNTHETIC** — This substrate is for governed
> client-showcase rehearsal only. It must never be pointed at production ERP/SIS,
> staging, or ordinary Founder F5 local development databases.

## Approved client scenario identity

- **Approved client scenario (showcase narrative):** `AIEOS360-CX-SCENARIO-01`
- **Package / rehearsal scenario id:** `aieos360-cx01-i01-showcase-rehearsal` (engineering substrate label; distinct from the approved client scenario id)

CI proof artifacts under `tmp/cx01-proof-exports/` are **sanitized** (no full database URLs, passwords, or development bearer tokens). Historical workflow artifact `11413231236` uploaded pre-I01R3 exports that included credential-bearing `db.json` / `fixture.json`; those objects were governed **test** credentials only (not production), and future uploads use sanitized exports only.

## Classification and safety

- Dedicated disposable PostgreSQL **18** Docker container:
  `aieos-aieos360-cx01-i01-showcase-pg` on host port **55448**
- Destructive `reset` recreates the database and clears prior rehearsal outputs
  (TeachingAssignment, LearnerAttempt, LearnerSubmission, evaluations)
- Reset **fails closed** unless the target matches the dedicated CX01 container
  and port, or the governed CI external-PostgreSQL lane flag is set
- **Deterministic AI only** — `FakeStructuredModelGateway`; no Groq/OpenAI keys

## Governed source pins (exact)

| Authority | SHA |
| --- | --- |
| Architecture | `491295c3cf0a151f31686a6a2e1a2176cd92c782` |
| Product | `b4b3048fb7a6a1c50ae8619dc490743714f2e3e2` |
| Backend | `637583f42b7c475ef83f6f99bca7e65e665a253d` |
| Frontend base | `80125be6cf172afb5137e845752c5b4505e5a97f` |
| Infrastructure | `a8654e5bc680eac1fa93cf8308d7cad904f4d7b9` |
| OpenAPI SHA-256 | `4042FB2725DA70A02A70EE09563B7698AE2E5DA82927614CAF1B5F7E6AA7C1D0` |
| Alembic head | `a360s010004` |

## Prerequisites

- Node **24** + pnpm **11** (see `package.json`)
- [uv](https://docs.astral.sh/uv/) with Python **3.14**
- Docker (for local dedicated PostgreSQL 18)
- Backend checkout at pin SHA:

  ```bash
  git clone https://github.com/eduvijna-ai/eduvijna-aieos-backend.git
  cd eduvijna-aieos-backend
  git checkout 637583f42b7c475ef83f6f99bca7e65e665a253d
  uv sync --locked --group dev
  ```

- Frontend checkout + `pnpm install --frozen-lockfile`
- Export backend path:

  ```bash
  export AIEOS_BACKEND_ROOT=/path/to/eduvijna-aieos-backend
  ```

## Operator commands

| Action | pnpm | Node equivalent |
| --- | --- | --- |
| Reset / reseed | `pnpm showcase:aieos360:reset` | `node scripts/aieos360-cx01-i01-showcase-rehearsal/reset.mjs` |
| Start roles | `pnpm showcase:aieos360:start` | `node scripts/aieos360-cx01-i01-showcase-rehearsal/start.mjs` |
| Status | `pnpm showcase:aieos360:status` | `node scripts/aieos360-cx01-i01-showcase-rehearsal/status.mjs` |
| Stop / cleanup | `pnpm showcase:aieos360:stop` | `node scripts/aieos360-cx01-i01-showcase-rehearsal/stop.mjs` |

PowerShell:

```powershell
$env:AIEOS_BACKEND_ROOT = "C:\path\to\eduvijna-aieos-backend"
pnpm showcase:aieos360:reset
pnpm showcase:aieos360:start
```

Skip automatic reset on start (reuse current DB):

```bash
AIEOS360_CX01_I01_SHOWCASE_SKIP_RESET=1 pnpm showcase:aieos360:start
```

## Role port map (defaults)

| Role | Frontend | Backend |
| --- | --- | --- |
| Teacher | http://127.0.0.1:5291 | http://127.0.0.1:8020 |
| Student | http://127.0.0.1:5292 | http://127.0.0.1:8021 |
| Principal | http://127.0.0.1:5293 | http://127.0.0.1:8022 |
| Parent | http://127.0.0.1:5294 | http://127.0.0.1:8023 |

## Development identities

Canonical tenant and principals come from
`DevelopmentCoherentSchoolContextProvider()` defaults (see fixture after reset).

Opaque bearer tokens (transport only):

- Teacher: `aieos360-cx01-i01-showcase-teacher`
- Student A / B: `dev-student-a` / `dev-student-b`
- Principal: `aieos360-cx01-i01-showcase-principal`
- Parent: `aieos360-cx01-i01-showcase-parent`

Class refs: `class-5a`, `class-5b`

## Artifacts (local, no secrets)

| File | Purpose |
| --- | --- |
| `tmp/aieos360-cx01-i01-showcase-db.json` | Shared DB bootstrap report |
| `tmp/aieos360-cx01-i01-showcase-fixture.json` | Seeded scenario precondition |
| `tmp/aieos360-cx01-i01-showcase-manifest.json` | Machine-readable rehearsal manifest |
| `tmp/aieos360-cx01-i01-showcase-status.json` | Operator status snapshot |

## Reset safety fence

Destructive reset validates **parsed** database URLs (host, port, database, role user,
password) against the approved disposable substrates. External CI PostgreSQL requires an
explicit operator/CI flag:

`AIEOS360_CX01_I01_SHOWCASE_CI_EXTERNAL_PG=1`

Substring credential checks are not used. Production/non-loopback hosts are rejected.

The machine-readable manifest records both `frontend_governed_base_sha` (W01 pin) and
`frontend_execution_sha` (checkout HEAD at reset time). Database URLs and secrets are
never written to the manifest.

## What reset destroys vs preserves

**Destroyed / recreated**

- Dedicated CX01 PostgreSQL container and all application data inside it
- Prior rehearsal TeachingAssignment / LearnerAttempt / LearnerSubmission /
  LearnerAssessmentEvaluation outputs

**Not touched**

- Historical S04-I03 / I05 / product E2E lanes and their containers
- Ordinary Founder F5 local databases (different ports / containers)
- Production, staging, or cloud infrastructure

## Troubleshooting

- **Pin guard failure** — Backend HEAD or OpenAPI digest drifted; checkout exact pins.
- **Reset blocked** — Wrong container/port or missing CI external flag.
- **Port in use** — Stop rehearsal (`pnpm showcase:aieos360:stop`) or override
  `AIEOS360_CX01_I01_SHOWCASE_*_PORT` variables.

## Automated proofs

```bash
AIEOS360_CX01_I01_SHOWCASE_INTEGRATION=1 pnpm test:cx01-i01-showcase-proof
```

Runs repeatability proof (double reset + assignment cleanup) when `AIEOS_BACKEND_ROOT`
is set and Docker or CI PostgreSQL is available.
