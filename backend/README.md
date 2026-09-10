# MHC backend

Express API. Every LLM call goes through `src/llmClient.js`, every generation
route calls a function in `src/services/`, and the OKX A2MCP handler (once
added) will call those same service functions rather than duplicating logic.

## Local env vars

Copy `.env.example` to `.env` and fill in `DATABASE_URL`, `LLM_BASE_URL`,
`LLM_API_KEY`, `LLM_MODEL`, `JWT_SECRET`, `CORS_ORIGIN`.

## Routes

- `POST /users/session` — email in, session cookie out. Temporary until
  OKX AI Marketplace is the real account layer.
- `POST /ingest`, `GET /ingest` — add/read entries for the signed-in user.
- `POST /generate/report`, `/generate/prep`, `/generate/letter` — the core
  loop, signed-in only.
- `GET /predictions/info?topic=` — read-only, no auth.
- `POST /anchor` — stub, returns 501 until the OnchainOS wallet is wired up.
- `POST /demo/generate` — no auth, rate-limited 5/hour/IP, never touches
  user tables.
- `GET /stats/public` — no auth, counts only (reports/letters/demo runs),
  powers the landing page's live stats strip. Never exposes content.
