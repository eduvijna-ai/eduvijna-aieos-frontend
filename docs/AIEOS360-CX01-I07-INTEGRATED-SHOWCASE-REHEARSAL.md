# AIEOS360-CX01-I07 — Integrated client showcase rehearsal

**NON_PRODUCTION / SYNTHETIC / DISPOSABLE PostgreSQL 18 only.**

## Governed pins (exact)

| Authority | SHA |
|---|---|
| Architecture | `491295c3cf0a151f31686a6a2e1a2176cd92c782` |
| Product | `b4b3048fb7a6a1c50ae8619dc490743714f2e3e2` |
| Backend | `637583f42b7c475ef83f6f99bca7e65e665a253d` |
| Frontend (I07 base) | `e7ff20b84ce8edabf1c849e8c19a7340cbaebcfa` |
| Infrastructure | `a8654e5bc680eac1fa93cf8308d7cad904f4d7b9` |
| OpenAPI SHA-256 | `4042FB2725DA70A02A70EE09563B7698AE2E5DA82927614CAF1B5F7E6AA7C1D0` |
| Alembic head | `a360s010004` |

Substrate: reuses **I01R9** managed lifecycle (`docs/AIEOS360-CX01-I01R9-SHOWCASE-REHEARSAL.md`). I06 mode truth: `docs/AIEOS360-CX01-I06-SHOWCASE-AI-MODE.md`.

## Human walkthrough

- **Full script:** this document §Story flow.
- **Cue sheet:** `docs/AIEOS360-CX01-I07-FOUNDER-CUE-SHEET.md`.
- **Preflight:** `docs/AIEOS360-CX01-I07-PRESENTER-PREFLIGHT.md`.
- **Coverage matrix:** `docs/AIEOS360-CX01-I07-COVERAGE-MATRIX.md`.

### Demonstration modes (both honest)

| Mode | Audience | Prepare / content lineage | Assign / learner proof |
|---|---|---|---|
| **A — Automated guard (CI / `pnpm showcase:aieos360:rehearse`)** | Engineering acceptance | Same run: Teacher **Prepare → kit → Review → Approve** using deterministic **Fake** gateway (`pass_preparation_kit`, worksheet questions `ws-1`…`ws-6`). I01R9 seed still supplies tenant, roles, and school context only. | Publish that **same-run** `ContentVersion` → assign **Grade 5A** → Student answers generated items → evaluate → improve → Principal/Parent negatives. |
| **B — Human presenter walkthrough** | Client rehearsal | Operator may open the I01R9 **seeded synthetic approved-but-unpublished worksheet** to explain prerequisites without running Prepare live. Label it synthetic; do not imply paid provider generation. | Publish/assign that seeded artifact **or** follow Mode A beats if the room allows the longer Prepare flow. Keep pre-connected DEV tabs per preflight. |

**REAL_AI live generation: PENDING** in both modes — default **DETERMINISTIC**; Fake output is not paid provider execution.

### Story flow (`AIEOS360-CX-SCENARIO-01`)

1. **Launcher** — `/showcase/aieos360?showcase=1` on Teacher frontend (default port 5291).
2. **Teacher Prepare** — Mode **A**: live Prepare → kit → Review → Approve (Fake). Mode **B**: optional narrative on seeded worksheet artifact only.
3. **Publish + Assign** — Publish the version you are demonstrating → assign to **Grade 5A** (`class-5a`).
4. **Student A** — Home → assignment → Start → Save → Submit.
5. **Teacher evaluation** — Assessment intelligence → explicit evaluate submitted work.
6. **Teacher improve** — Record HUMAN **Mixed** class assessment → Improve → remediation TeachingWork (same DB lineage).
7. **Principal** — School Intelligence aggregate (no learner drilldown).
8. **Parent** — Authorized child lifecycle only; evaluation existence concealed.

**REAL_AI live generation: PENDING** — default DETERMINISTIC; do not infer provider execution from composition alone.

## Automated integrated guard

```bash
export AIEOS_BACKEND_ROOT=/path/to/eduvijna-aieos-backend
pnpm showcase:aieos360:rehearse   # local Linux: I01R9 reset/start → guard → stop
# CI isolated composition (external PostgreSQL, ports 5295–5298 / 8024–8027):
pnpm test:e2e:aieos360-cx01-i07
```

- Local `rehearse` reuses the **managed I01R9 stack** (5291–5294 / 8020–8023) without reseeding.
- CI job uses a **separate composition** (same I01R9 seed/serve code, isolated ports/DB).
- **Zero** Playwright `/api` mocks.
- Sanitized report: `tmp/aieos360-cx01-i07-rehearsal-report.json` (no bearer tokens).

CI job: `aieos360-cx01-i07-e2e`.

## Operator lifecycle

```bash
pnpm showcase:aieos360:reset
pnpm showcase:aieos360:start
pnpm showcase:aieos360:status
# … human rehearsal …
pnpm showcase:aieos360:stop
```

Repeatability and owned PG cleanup: `pnpm test:cx01-i01r9-showcase-proof` (I01R9 package).

## Evidence package (sanitized)

| Artifact | Purpose |
|---|---|
| `tmp/aieos360-cx01-i07-rehearsal-report.json` | Rehearse runner outcome |
| `tmp/aieos360-cx01-i07-e2e-persistence.json` | SoR snapshot after guard |
| `playwright-aieos360-cx01-i07-report/` | HTML trace (CI artifact on failure) |
