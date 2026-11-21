# PK-V1-HINT-T0-F-I01 — Teacher learner-hint authoring and review attestation

## Scope

Frontend-only Teacher OS UX for worksheet `education.worksheet@2` learner hints:

- Library owner authors optional per-question `learner_hint` via guarded append.
- Independent reviewer records structured `per_question_outcomes` before approve.

## Backend contract pin

| Field | Value |
|-------|--------|
| Backend main | `5bbc09bc895407b71a61f9ba86a7209ff9c10ffa` |
| OpenAPI SHA-256 | `0061BCF6065FAFA184F196829A87AF98ADEDFCE6B633D45704141A5B48045D22` |

Operations: `content_worksheet_hint_version_append`,
`content_worksheet_hint_attestation_record`.

## Routes

- `/teacher-os/library/:contentId/learner-hints` — authoring
- Review detail unchanged path; hint panel inline for hint-bearing `@2` worksheets

## I01R1 privacy and workflow

- Review detail loads Content aggregate ETag only for hint-bearing worksheet `@2`.
- Session-object, route, and generation fences guard review detail, attestation,
  and authoring append/submit; stale async responses cannot update a new session.
- Authoring preserves in-memory hint drafts across recoverable 412/revalidation;
  ambiguous append outcomes re-read Content when safe or stay UNCERTAIN with drafts.
- Attestation checklists reset on version/payload/session change; invalid
  `learner_hint` keys fail closed in review.

## I01R2 version and review identity

- After 412 or authoritative source drift, authoring keeps in-memory drafts but
  requires explicit reconciliation before create/submit; unassigned text is
  preserved when question bindings change.
- Attestation POST captures a live resource identity snapshot (session, ETag,
  payload reference, generation) and ignores late success after payload refresh.
- Session invalidation clears stale append/submit in-flight refs so a new
  teacher can act without a permanent busy lock.

## Out of scope

Production grants, Backend edits, Student hint GET changes, full Hint E2E,
auto publish/approve.