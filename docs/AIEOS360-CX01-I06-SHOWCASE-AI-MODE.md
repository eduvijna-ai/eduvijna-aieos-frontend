# AIEOS360-CX01-I06 — Showcase AI mode governance (NON_PRODUCTION)

Operator-only showcase runtime modes for the existing CX01-I01R9 managed rehearsal:

| Mode | Default | Teacher backend gateway |
| --- | --- | --- |
| `DETERMINISTIC` | yes | Governed `FakeStructuredModelGateway` + seeded synthetic worksheet |
| `REAL_AI` | no (explicit opt-in) | Existing Backend `compose_configured_model_provider` (Groq/OpenAI) |

## Operator control

1. Stop the managed stack (`pnpm showcase:aieos360:stop`).
2. Set operator shell environment **before** `pnpm showcase:aieos360:start`:
   - `AIEOS360_CX01_I06_SHOWCASE_MODE=DETERMINISTIC` (default when unset)
   - `AIEOS360_CX01_I06_SHOWCASE_MODE=REAL_AI` plus `AIEOS_AI_PROVIDER=groq|openai` and the matching `AIEOS_*_API_KEY`
3. Optional validation while stopped: `pnpm showcase:aieos360:configure-mode`

Mode cannot change while the managed stack is running. Browser URL/query parameters are not authority for provider runtime.

## Credential isolation

Provider API secrets are scrubbed from Student/Principal/Parent backends, all Vite processes, and Python reset/seed/status helpers. Only the Teacher backend process receives provider credentials in `REAL_AI` mode.

## Runtime truth

Managed `start`/`status` and the launcher read Provider Aggregator facts from the Teacher backend (`GET /api/v1/platform/ai/providers`). The seeded I01R9 worksheet remains a **synthetic prerequisite** and is never relabeled as real-AI output.
