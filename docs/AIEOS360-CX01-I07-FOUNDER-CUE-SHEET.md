# AIEOS360-CX01-I07 — Founder cue sheet (one page)

**NON_PRODUCTION / SYNTHETIC — not production ERP/SIS data.**

## Before you begin

1. Operator runs local preflight (`docs/AIEOS360-CX01-I07-PRESENTER-PREFLIGHT.md`) — **not** during the client story.
2. `pnpm showcase:aieos360:reset` → `pnpm showcase:aieos360:start` → confirm `pnpm showcase:aieos360:status` is `running`.
3. Open launcher: `http://127.0.0.1:5291/aieos360/showcase?showcase=1` (Teacher port; adjust if overridden).
4. Default mode **DETERMINISTIC**. **REAL_AI live generation remains PENDING** — do not imply live provider output.

## Story beats (in order)

| # | Role | Say / show | Evidence |
|---|---|---|---|
| 1 | Teacher | “We prepared and approved content; publishing is a deliberate act.” | Publish control; synthetic seeded worksheet labelled in runbook |
| 2 | Teacher | “Grade 5A receives the assignment.” | Assign to **Grade 5A** / `class-5a` |
| 3 | Student | “Learner starts, saves, submits.” | START → SAVE → SUBMIT |
| 4 | Teacher | “Evaluation is explicit policy, not automatic mastery.” | Assessment intelligence → evaluate submitted work |
| 5 | Teacher | “Human class judgment, then deliberate improve.” | Record **Mixed** class assessment → **Improve this class** |
| 6 | Principal | “Leadership sees aggregates only.” | School Intelligence — two classes, activity on 5A only |
| 7 | Parent | “Family sees lifecycle, not rubric or scores.” | Child submitted state; **no evaluation existence** |

## Safe exit

`pnpm showcase:aieos360:stop` — never share DEV bearer tokens or paste secrets on screen.
