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

## Out of scope

Production grants, Backend edits, Student hint GET changes, full Hint E2E,
auto publish/approve.