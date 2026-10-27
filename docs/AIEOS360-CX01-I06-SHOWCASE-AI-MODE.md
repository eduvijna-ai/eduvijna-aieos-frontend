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

Managed `start`/`status` query the Teacher backend Provider Aggregator on loopback with the governed synthetic `X-AIEOS-Tenant-ID` header only (operator-side, NON_PRODUCTION). The launcher reads the sanitized operator-verified runtime surface (`public/aieos360-showcase-runtime.json`, gitignored) written at successful managed start; it is cleared/marked inactive on stop, reset, and start failure.

Provider Aggregator composition (`mode=REAL`, provider/model ids) is **not** live generation proof. `real_provider_generation_verified` is always false in I06 harness code paths; `live_generation_verification` stays `pending_operator_proof` until a separate governed generation/ContentVersion evidence flow exists.

Managed `start`/`reset`/`stop` invalidate the owned runtime surface before fallible preflight work (after registry safety gates). The CX01-I01R9 integration proof lane executes `provider_aggregator_tenant_contract_proof.py` on every backend-ready CI run.

The seeded I01R9 worksheet remains a **synthetic prerequisite** and is never relabeled as real-AI output.
