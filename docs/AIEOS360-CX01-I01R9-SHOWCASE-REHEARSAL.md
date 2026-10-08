# AIEOS360-CX01-I01R9 — Showcase rehearsal environment

**NON_PRODUCTION / DISPOSABLE / SYNTHETIC — not for production ERP/SIS or real learner data.**

Supersedes the closed-unmerged PR #34 implementation with a **smaller Linux-managed lifecycle**:
`reset → managed start → status → rehearsal → explicit stop`.

## Classification and safety

- Dedicated PostgreSQL **18** Docker container: `aieos-aieos360-cx01-i01-showcase-pg` on host port **55448**
- Destructive reset is **fail-closed** unless the target matches the governed CX01 rehearsal substrate
- Ordinary Founder F5 / product-e2e databases are **not** targeted
- Default mode is **deterministic** (`FakeStructuredModelGateway`); no Groq/OpenAI/Anthropic/Gemini credentials

## Governed pins (exact)

| Authority | SHA |
|---|---|
| Architecture | `491295c3cf0a151f31686a6a2e1a2176cd92c782` |
| Product | `b4b3048fb7a6a1c50ae8619dc490743714f2e3e2` |
| Backend | `637583f42b7c475ef83f6f99bca7e65e665a253d` |
| Frontend base | `80125be6cf172afb5137e845752c5b4505e5a97f` |
| Infrastructure | `a8654e5bc680eac1fa93cf8308d7cad904f4d7b9` |
| OpenAPI SHA-256 | `4042FB2725DA70A02A70EE09563B7698AE2E5DA82927614CAF1B5F7E6AA7C1D0` |
| Alembic head | `a360s010004` |

## Prerequisites

- Node **24** + pnpm **11** (repo `engines`)
- `AIEOS_BACKEND_ROOT` → backend checkout at pin `637583f42b7c475ef83f6f99bca7e65e665a253d`
- **Linux** for `start` / `stop` (canonical runtime). On Windows use **PowerShell → WSL2** and run the same commands inside WSL.

## Operator commands

```bash
export AIEOS_BACKEND_ROOT=/path/to/eduvijna-aieos-backend   # at governed pin

pnpm showcase:aieos360:reset
pnpm showcase:aieos360:start    # managed: exits after four roles are ready
pnpm showcase:aieos360:status
pnpm showcase:aieos360:stop     # SIGTERM → bounded wait → SIGKILL on recorded process groups
```

## Role port map (defaults)

| Role | Backend | Frontend (entry path) |
|---|---|---|
| Teacher | 8020 | 5291 → `/teacher-os/today` |
| Student | 8021 | 5292 → `/student-os/home` |
| Principal | 8022 | 5293 → `/principal-os` |
| Parent | 8023 | 5294 → `/parent-os` |

`pnpm showcase:aieos360:status` probes live HTTP for all eight managed processes when `phase` is `running` (set `AIEOS360_CX01_I01_SHOWCASE_STATUS_SKIP_LIVE=1` only to skip probes). `stop` removes the governed local PostgreSQL container when this lifecycle started it; external CI PostgreSQL is never touched.

Bearer tokens and principal UUIDs match backend `DevelopmentCoherentSchoolContextProvider()` defaults (see fixture after reset).

## Artifacts (local, no secrets in manifest)

| Path | Purpose |
|---|---|
| `tmp/aieos360-cx01-i01-showcase-manifest.json` | Machine-readable rehearsal manifest |
| `tmp/aieos360-cx01-i01-showcase-fixture.json` | Seeded scenario fixture |
| `tmp/aieos360-cx01-i01-showcase-db.json` | Shared DB report |
| `tmp/aieos360-cx01-i01-showcase-status.json` | Operator phase / URLs |

## Reset destroys / does not destroy

**Recreates:** disposable rehearsal DB schema+data, tenant/HUMAN principals, coherent school-context prerequisites, deterministic worksheet seed, manifest.

**Clears:** prior `TeachingAssignment`, learner attempts/submissions/evaluations from earlier rehearsals on this substrate.

**Does not touch:** S04-I03 historical lane, product-e2e DB, staging/production, unrelated Docker resources.

## CI proof (bounded)

Job `aieos360-cx01-i01r9-showcase` runs `pnpm test:cx01-i01r9-showcase-proof` (opt-in integration): pin guard, reset×2 + pollution clearance, shared DB, managed start/status/stop — **no** interactive signal torture proofs.

## Explicit non-goals (I01R9)

Launcher UI, role switcher, real-AI toggle, Admin OS, CX01-I02+ — **not authorized** in this package.
