# AIEOS360-S04-I03-E2E (Integrated Cross-Role Real-Stack Proof)

Additive Playwright lane proving the complete current development AIEOS360
role chain against **one coherent School Context story**.

Teacher → Student → Assessment → Principal → Parent operate as four
projections of the same Admin/ERP/SIS School Context fact universe supplied by
`DevelopmentCoherentSchoolContextProvider` (canonical defaults).

**No `/api` Playwright mocks.** One shared PostgreSQL 18. No harness-local
Teacher/Student/Principal/Parent School Context authority maps. Historical
`aieos360-s03-i04-e2e`, `aieos360-s02-i04-e2e`, `aieos360-s01-i05-e2e`,
`product-e2e`, and `student-product-e2e` pins are unchanged.

## ADR basis

ADR-AIEOS-062 Frozen / Approved: Admin / ERP / SIS School Context is the
conceptual external business master for current class definitions, teacher ↔
class authority, learner ↔ class membership, Principal school/class scope, and
adult ↔ learner current access. AIEOS does not create competing School / Class /
Roster / Enrollment / Family / Guardian SoRs.

Admin/ERP Context = current-authority boundary. **Not** Admin OS.
No `PrincipalKind.ADMIN`. No `admin.*` capability.

## Governed pins

| Artifact | SHA / value |
|----------|-------------|
| Architecture | `b167bfd951cf9acecb6ff2470ed0fb8c1925097e` |
| Frontend base | `20a06f048510a2519e0487d12ea7c16f59e7fd7c` |
| Backend | `637583f42b7c475ef83f6f99bca7e65e665a253d` |
| OpenAPI authority | `4042FB2725DA70A02A70EE09563B7698AE2E5DA82927614CAF1B5F7E6AA7C1D0` |
| Migration head | `a360s010004` |

## Topology

```text
Teacher Vite :5281 ──/api──► Teacher FastAPI :8010 ──┐
Student Vite :5282 ──/api──► Student FastAPI :8011 ──┤
Principal Vite :5283 ──/api──► Principal FastAPI :8012 ──┼──► PostgreSQL 18 (ONE DATABASE)
Parent Vite  :5284 ──/api──► Parent FastAPI  :8013 ──┘
```

Each role FastAPI process instantiates
`DevelopmentCoherentSchoolContextProvider()` with **canonical defaults only**.

## Canonical coherent School Context story

| Fact | Value |
|------|-------|
| class-5a | Grade 5A |
| class-5b | Grade 5B |
| Teacher (`SYNTHETIC_PRINCIPAL_ID`) | class-5a, class-5b |
| Student A | member of class-5a |
| Student B | member of class-5b |
| Principal | scope class-5a, class-5b |
| Parent A | access Student A |
| Parent B | access Student B |

Unlike S03-I04, Parent A → Student A is **not** harness-local.

## Explicit non-claims

- Coherent development School Context ≠ production ERP integration
- Admin / ERP Context ≠ Admin OS
- Current-authority provider ≠ school/roster/family SoR
- Development Slice proof ≠ Production Ready
- Evaluated ≠ Mastered

## Run locally

```bash
export AIEOS_BACKEND_ROOT=/path/to/eduvijna-aieos-backend@637583f42b7c475ef83f6f99bca7e65e665a253d
pnpm test:e2e:aieos360-s04-i03
```

CI job: `aieos360-s04-i03-e2e` (contents: read only; PostgreSQL 18; frozen pnpm;
exact Backend pin + independently computed OpenAPI SHA-256).
