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

## Evidence confidentiality (I01R1)

- Local-only raw `tmp/pk-v1-hint-e2e-*.json` files are mode `0600` and excluded from CI artifacts.
- CI uploads only `tmp/pk-v1-hint-e2e-sanitized/` produced by `emit_sanitized_evidence.py`.
- Playwright trace/screenshot/video are OFF for this lane.

## SP02A S01–S67 ledger (sum = 67)

| Scenario | Policy (summary) | Evidence tier | Test / probe path | Run / SHA |
|----------|------------------|---------------|-------------------|-----------|
| S01 | Learner hint disclosure control | NOT_TESTED | `e2e-pk-v1-hint/learner-hint-vertical.product.spec.ts (await CI)` | NOT_EXECUTED_LOCAL / await Chief CI |
| S02 | Learner hint disclosure control | NOT_TESTED | `e2e-pk-v1-hint/learner-hint-vertical.product.spec.ts (await CI)` | NOT_EXECUTED_LOCAL / await Chief CI |
| S03 | Learner hint disclosure control | NOT_TESTED | `e2e-pk-v1-hint/learner-hint-vertical.product.spec.ts (await CI)` | NOT_EXECUTED_LOCAL / await Chief CI |
| S04 | Learner hint disclosure control | NOT_TESTED | `e2e-pk-v1-hint/learner-hint-vertical.product.spec.ts (await CI)` | NOT_EXECUTED_LOCAL / await Chief CI |
| S05 | Learner hint disclosure control | NOT_TESTED | `tests/domains/learning/test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S06 | Learner hint disclosure control | NOT_TESTED | `e2e-pk-v1-hint/learner-hint-vertical.product.spec.ts (await CI)` | NOT_EXECUTED_LOCAL / await Chief CI |
| S07 | Learner hint disclosure control | NOT_TESTED | `e2e-pk-v1-hint/learner-hint-vertical.product.spec.ts (await CI)` | NOT_EXECUTED_LOCAL / await Chief CI |
| S08 | Learner hint disclosure control | NOT_TESTED | `e2e-pk-v1-hint/learner-hint-vertical.product.spec.ts (await CI)` | NOT_EXECUTED_LOCAL / await Chief CI |
| S09 | Learner hint disclosure control | NOT_TESTED | `e2e-pk-v1-hint/learner-hint-vertical.product.spec.ts (await CI)` | NOT_EXECUTED_LOCAL / await Chief CI |
| S10 | Learner hint disclosure control | NOT_TESTED | `e2e-pk-v1-hint/learner-hint-vertical.product.spec.ts (await CI)` | NOT_EXECUTED_LOCAL / await Chief CI |
| S11 | Learner hint disclosure control | NOT_TESTED | `tests/domains/learning/test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S12 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S13 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S14 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S15 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S16 | Learner hint disclosure control | NOT_TESTED | `tests/domains/learning/test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S17 | Learner hint disclosure control | NOT_TESTED | `tests/domains/learning/test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S18 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S19 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S20 | Learner hint disclosure control | NOT_TESTED | `tests/domains/learning/test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S21 | Learner hint disclosure control | NOT_TESTED | `e2e-pk-v1-hint/learner-hint-vertical.product.spec.ts (await CI)` | NOT_EXECUTED_LOCAL / await Chief CI |
| S22 | Learner hint disclosure control | CURRENT_BACKEND_PG_HTTP_PROOF | `tests/domains/learning/test_aieos_v1_hint_b.py::TestLearnerHintsConcurrency` | NOT_EXECUTED_LOCAL / await Chief CI |
| S23 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S24 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S25 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S26 | Learner hint disclosure control | NOT_TESTED | `tests/domains/learning/test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S27 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S28 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S29 | Learner hint disclosure control | NOT_TESTED | `tests/domains/learning/test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S30 | Learner hint disclosure control | DEFERRED_BY_ADR | `ADR-AIEOS-063 SP02A exclusion` | NOT_EXECUTED_LOCAL / await Chief CI |
| S31 | Learner hint disclosure control | DEFERRED_BY_ADR | `ADR-AIEOS-063 SP02A exclusion` | NOT_EXECUTED_LOCAL / await Chief CI |
| S32 | Learner hint disclosure control | NOT_TESTED | `tests/domains/learning/test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S33 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S34 | Learner hint disclosure control | NOT_TESTED | `tests/domains/learning/test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S35 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S36 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S37 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S38 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S39 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S40 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S41 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S42 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S43 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S44 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S45 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S46 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S47 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S48 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S49 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S50 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S51 | Learner hint disclosure control | CURRENT_BACKEND_PG_HTTP_PROOF | `tests/domains/learning/test_aieos_v1_hint_b.py::TestLearnerHintsConcurrency` | NOT_EXECUTED_LOCAL / await Chief CI |
| S52 | Learner hint disclosure control | CURRENT_BACKEND_PG_HTTP_PROOF | `tests/domains/learning/test_aieos_v1_hint_b.py::TestLearnerHintsConcurrency` | NOT_EXECUTED_LOCAL / await Chief CI |
| S53 | Learner hint disclosure control | CURRENT_BACKEND_PG_HTTP_PROOF | `tests/domains/learning/test_aieos_v1_hint_b.py::TestLearnerHintsConcurrency` | NOT_EXECUTED_LOCAL / await Chief CI |
| S54 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S55 | Learner hint disclosure control | NOT_TESTED | `tests/domains/learning/test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S56 | Learner hint disclosure control | NOT_TESTED | `tests/domains/learning/test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S57 | Learner hint disclosure control | NOT_TESTED | `e2e-pk-v1-hint Phase H–I Assessment→Improve (await CI)` | NOT_EXECUTED_LOCAL / await Chief CI |
| S58 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S59 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S60 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S61 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S62 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S63 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S64 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S65 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S66 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |
| S67 | Learner hint disclosure control | NOT_TESTED | `tests/domains/education/test_aieos_v1_hint_t0_b_http.py and/or test_aieos_v1_hint_b.py` | NOT_EXECUTED_LOCAL / await Chief CI |


### Tier counts

- CURRENT_BACKEND_PG_HTTP_PROOF: 4
- DEFERRED_BY_ADR: 2
- NOT_TESTED: 61
- **Total**: 67

## Explicit non-claims

- No `REAL_STACK_EXECUTED_PASS` row is claimed until Chief-controlled CI executes the lane.
- Development harness ≠ production ERP/SIS integration
- Product source `b4b3048…` Chief-attested; Cursor-unverified (404)
- Architecture pin `3c0a66aa…` Chief-attested; Cursor GitHub connector could not verify architecture repo
