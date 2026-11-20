# PK-V1-HINT-F-I01 — Learner hint UX (Student OS)

Frontend-only draft implementing optional, student-initiated pedagogical hints
within an owned `IN_PROGRESS` learning attempt.

## HTTP contract

- **Operation:** `learning_attempt_learner_hints_get`
- **Method/path:** `GET /api/v1/learning/attempts/{attempt_id}/learner-hints`
- **Success DTO:** `{ attempt_id, content_version_id, hints: [{ question_id, hint_text }] }`
- **Client:** `getLearningAttemptLearnerHints` in `studentLearningApi.ts` with
  `cache: "no-store"` and optional `AbortSignal`.

No per-question route, no hint data on assignment/attempt list DTOs, no
persistence or analytics payload.

## UX policy

- Hints appear only on `/student-os/attempts/:attemptId` while
  `lifecycle_state === IN_PROGRESS`.
- No prefetch; each **Show hint** issues a fresh attempt-scoped GET.
- Only the clicked question’s allowlisted `hint_text` is rendered (plain text).
- `attempt_id` and `content_version_id` in the response must match the loaded
  attempt; otherwise the body is discarded.
- Hints purge on save/submit start, submit success, route/attempt change,
  **connected session object incarnation** change (not bearer fingerprint),
  unmount, disabled lifecycle, and abort/epoch invalidation (late GET after
  submit is ignored).
- Attempt/assignment loads use generation + session + route fences so late
  responses cannot commit across session swaps (fail closed).
- Ambiguous save/submit outcomes keep hints disabled until a fresh in-session
  attempt read confirms `IN_PROGRESS`.
- Runtime fail-closed validation of hint GET JSON at `learnerHintPolicy.ts`
  (attempt/version binding, allowlisted questions, hint text **Unicode scalar**
  bounds 1–500).

## Tests

- `attempt.learner-hint.test.tsx` — UI contract (mock HTTP).
- `learnerHintPolicy.test.ts` — response binding verification.

Full-stack Hint E2E remains `PK-V1-HINT-E2E` (separate authorization).

## OpenAPI consumer pin

| Field | Value |
|-------|--------|
| Backend main | `e8c7154e7207ac1b39cef244b5084ae5cc1ae07b` |
| OpenAPI SHA-256 | `43F877E122389A7347DDB00D25F37D8BE8BD907F43FF6960E5DC6E794B1A0071` |