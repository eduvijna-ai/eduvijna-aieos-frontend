# CX01-I07 — Presenter / operator preflight (local, NON_PRODUCTION)

Complete **before** the live client walkthrough. Do not paste bearer tokens during the story.

## Security rules

- DEV session connector is **memory-only** per role tab; reconnect using the launcher between stages.
- Never put bearer tokens in URLs, `VITE_*`, screenshots, fixtures, or GitHub.
- No automatic impersonation or hidden auth bypass.

## Steps

1. `export AIEOS_BACKEND_ROOT=/path/to/eduvijna-aieos-backend` (pin `637583f42b7c475ef83f6f99bca7e65e665a253d`).
2. `pnpm showcase:aieos360:reset` then `pnpm showcase:aieos360:start`.
3. `pnpm showcase:aieos360:status` — all eight processes healthy.
4. Open launcher `http://127.0.0.1:5291/showcase/aieos360?showcase=1` (adjust host/ports per status JSON).
5. Open each role in a **dedicated tab** from the launcher; expand **DEV session** in that tab and connect using tenant + bearer from the **local non-exported fixture** `tmp/aieos360-cx01-i01-showcase-fixture.json` (operator machine only — never display to clients). The emitted `tmp/aieos360-cx01-i01-showcase-manifest.json` is **sanitized** and does not contain bearer tokens.
6. **Keep those connected tabs** for the walkthrough; opening a new tab does not inherit session state.
7. Confirm **DETERMINISTIC** mode on launcher truth panel (`REAL_AI LIVE GENERATION PENDING`).
8. Choose demonstration mode from the runbook: **Mode A** (live Prepare → kit, matches automated guard) or **Mode B** (seeded worksheet narrative only). Do not mix content versions mid-story.

## Limitation (honest)

There is no SSO or single-click role switching. Pre-connect is required; this is a bounded NON_PRODUCTION rehearsal constraint, not production identity design.
