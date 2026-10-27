# AIEOS360-CX-SCENARIO-01 — CX01-I07 evidence matrix

**Scenario:** `AIEOS360-CX-SCENARIO-01` on I01R9 substrate (`aieos360-cx01-i01-showcase-rehearsal`).

| Step | Screen / path | Backend operation (frozen) | I07 integrated guard | Historical separate proof |
|---|---|---|---|---|
| 1 Prepare → Review → Approve → Publish | `/teacher-os/prepare` → work kit → review → publish | Generate / approve / publish | **PROVEN LIVE ON SAME I07 SUBSTRATE** — Phase A in-run deterministic prepare kit + approve; Phase B publish (Fake gateway, not paid provider). | TOS / Teacher product E2E (historical separate) |
| 2 Assign class-5a | Teacher assign UI | `POST /teaching/assignments` | **PROVEN LIVE ON SAME I07 SUBSTRATE** | S04-I03 (separate seed) |
| 3 Teach / class assess (optional) | — | — | **DEFERRED** (optional beat) | — |
| 4 Student Start/Save/Submit | Student OS assignment | Learning attempts / submissions | **PROVEN LIVE ON SAME I07 SUBSTRATE** | S04-I03 |
| 5 Explicit evaluation | Teacher assess intelligence | `ensure-evaluations` | **PROVEN LIVE ON SAME I07 SUBSTRATE** | S04-I03 |
| 6 Assessment intelligence → Improve | Teacher assess → improve | ClassroomAssessment + remediation work | **PROVEN LIVE ON SAME I07 SUBSTRATE** | S01-I05 (separate seed) |
| 7 Principal aggregate | Principal OS | School intelligence GET | **PROVEN LIVE ON SAME I07 SUBSTRATE** | S04-I03 |
| 8 Parent child lifecycle | Parent OS | Parent home / child GET | **PROVEN LIVE ON SAME I07 SUBSTRATE** | S04-I03 |
| 9 Coherent school context | All roles | `DevelopmentCoherentSchoolContextProvider` | **PROVEN LIVE ON SAME I07 SUBSTRATE** | S04-I03 |
| Privacy negatives (Student B, tenant) | Student / API | Fail-closed reads | **PROVEN LIVE ON SAME I07 SUBSTRATE** | S04-I03 + I07 tenant negative |
| Reset ×2 / lifecycle | `showcase:aieos360:*` | Disposable PG 18 | **PROVEN BY HISTORICAL SEPARATE TEST** (`test:cx01-i01r9-showcase-proof`) | I01R9 |
| REAL_AI live generation | Operator-only | Provider aggregator | **PENDING** | I06 docs |

Automated guard: `pnpm test:e2e:aieos360-cx01-i07` / `pnpm showcase:aieos360:rehearse` — **zero** Playwright `/api` mocks, single shared DB lineage per run.
