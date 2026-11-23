# PK-V1-HINT-E2E-I01 — Real-Stack Learner-Hint Proof (NON_PRODUCTION)

Additive Playwright lane plus Backend PostgreSQL HTTP probes at pinned Backend
`5bbc09bc895407b71a61f9ba86a7209ff9c10ffa`, OpenAPI SHA-256
`0061BCF6065FAFA184F196829A87AF98ADEDFCE6B633D45704141A5B48045D22`, Alembic
head `a360s010005`.

## Topology

```text
Teacher Vite :5191 ──/api──► Teacher FastAPI :8028 ──┐
Student Vite :5192 ──/api──► Student FastAPI :8029 ──┴──► PostgreSQL 18 (ONE DATABASE)
```

Three opaque teacher bearer aliases map to distinct HUMAN principals (author,
reviewer, publisher) via harness-local composition only. Student uses
`dev-student-a`.

## Run locally

```bash
export AIEOS_BACKEND_ROOT=/path/to/eduvijna-aieos-backend@5bbc09bc895407b71a61f9ba86a7209ff9c10ffa
pnpm test:e2e:pk-v1-hint
```

## SP02A scenario ledger (summary)

Full classification is maintained in CI artifacts and backend probe output.
Executed in this lane:

| Class | Coverage |
|-------|----------|
| REAL_STACK_EXECUTED_PASS | Cross-role vertical (author → reviewer → publisher → assign → student hint → submit deny) in `e2e-pk-v1-hint/learner-hint-vertical.product.spec.ts` |
| CURRENT_BACKEND_PG_HTTP_PROOF | `tests/domains/learning/test_aieos_v1_hint_b.py`, `tests/domains/education/test_aieos_v1_hint_t0_b_http.py` via `run_backend_hint_probes.py` |
| DEFERRED_BY_ADR | S30, S31 (unchanged SP02A exclusions) |
| NOT_TESTED / GAP | Remaining SP02A rows without dedicated probe mapping in I01 scope — see Chief review |

## Explicit non-claims

- Development harness ≠ production ERP/SIS integration
- Product source `b4b3048…` Chief-attested; Cursor-unverified (404)
- Architecture pin `3c0a66aa…` Chief-attested; Cursor GitHub connector could not verify architecture repo