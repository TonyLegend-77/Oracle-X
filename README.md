# Oracle X — AI Cross-Market Alpha Engine

Bitget AI Base Camp · Hackathon S2 entry.

> Don't predict an asset in isolation. Predict how information propagates between markets.

Oracle X watches crypto, tokenized US equities, and real-world events
simultaneously, discovers cross-market opportunities, explains the causal
chain, simulates the trade, and learns from the outcome.

## Architecture

```
MARKET DATA (Bitget) ──▶ EVENT STREAM
                              │
                    Agent 1 — SENTINEL (finds events)
                              │
                    Agent 2 — INTERPRETER (Qwen: event → structured JSON)
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼             ▼
          Correlation     Lead/Lag     Displacement
                └─────────────┼─────────────┘
                              ▼
                    Agent 3 — RELATIONSHIP HUNTER
                              ▼
                    Agent 4 — ALPHA ANALYST (Alpha Score 0-100)
                              ▼
          Agent 5a — RISK ANALYST (Qwen, advisory only)
          Agent 5b — RISK GATE (deterministic, the actual enforcement layer)
                              ▼
                    Agent 6 — NARRATOR (Qwen: causal-chain explanation)
                              ▼
                 EXPLAINABLE OPPORTUNITY (Signal Card)
                              ▼
                       SIMULATION ENGINE
                              ▼
                          OUTCOME
                              ▼
                       TRADE AUTOPSY
                              ▼
              FACTOR WEIGHT UPDATE (self-improvement loop)
```

### Why Risk Guardian is split into two agents

NightDesk (Bitget S1, 1st place) won on the strength of a structural
enforcement layer — the agent literally cannot violate the policy, because
it's enforced onchain, not just reasoned about by an LLM. Oracle X borrows
that principle without going onchain: `risk_gate.py` is a plain
deterministic function, not an LLM call, and it is the *only* code path
allowed to mark a signal `risk_status=PASS`. `risk_analyst.py` gives a
qualitative Qwen opinion alongside it, but that opinion is advisory and
logged — it cannot itself pass or block a signal. Every evaluation (pass
and block) is logged to `risk_gate_log` so the demo can show real rejected
signals, not just the ones that made it through.

## Repo layout

```
backend/
├── app/
│   ├── agents/        sentinel · interpreter · relationship · alpha ·
│   │                  risk_analyst · risk_gate · narrator
│   ├── quant/          correlation · displacement · momentum · regime · scoring
│   ├── data/           bitget_client · qwen_client
│   ├── api/             routes_signals · routes_market · routes_simulate
│   ├── models.py        SQLAlchemy ORM (mirrors db/schema.sql)
│   ├── db.py            engine/session
│   ├── config.py        env vars, asset universe, risk limits, factor weights
│   └── main.py           FastAPI entrypoint
├── db/schema.sql        full Postgres DDL
└── requirements.txt
frontend/                Next.js app (dashboard, market-map, signals, simulation)
docs/                     architecture notes
backtesting/, prompts/, notebooks/   scaffolded, to be filled during build
```

## Setup

```bash
cd backend
cp .env.example .env        # fill in BITGET + QWEN credentials
pip install -r requirements.txt

# create DB, then load schema
createdb oracle_x
psql oracle_x < db/schema.sql

uvicorn app.main:app --reload
```

Health check: `GET /health`

## Frontend setup

```bash
cd frontend
cp .env.local.example .env.local   # point NEXT_PUBLIC_API_BASE at your backend
npm install
npm run dev
```

Design: dark data-terminal aesthetic (near-black base, amber signal accent —
deliberate nod to trading-terminal heritage, not a generic AI palette),
IBM Plex Sans for UI text, IBM Plex Mono reserved for numeric data only.
Three-column terminal layout: watchlist rail, center stage, opportunity feed.
The force-directed Market Map (`components/MarketMap.tsx`, d3-force) is the
demo centerpiece — live node/edge data from `/market/map`, draggable,
zoomable, correlation-colored edges. `components/CausalChain.tsx` renders
the vertical NVDA→Semiconductors→AMD-style propagation sequence from spec
section 23 as a companion panel on the Market Map page.

## Deploying (Railway + Vercel)

**Backend on Railway:**
1. New Project → Deploy from GitHub repo → set root directory to `backend`
2. Add a Postgres plugin to the same project (Railway sets `DATABASE_URL` automatically)
3. Set environment variables: `BITGET_API_KEY`, `BITGET_API_SECRET`,
   `BITGET_API_PASSPHRASE`, `QWEN_API_KEY`, `NEWSAPI_KEY` (see `.env.example`
   for the full list — `DATABASE_URL` and `PORT` are set by Railway itself,
   don't set those manually)
4. Railway auto-detects the `Procfile` (`web: uvicorn app.main:app --host
   0.0.0.0 --port $PORT`) — no separate start command needed
5. Schema applies itself on first boot (`app/db_init.py`, idempotent —
   safe to redeploy repeatedly, no manual `psql` step needed)
6. Once deployed, copy the Railway-generated public URL (e.g.
   `https://oracle-x-production.up.railway.app`)

**Frontend on Vercel:**
1. Import the GitHub repo, set root directory to `frontend`
2. Set `NEXT_PUBLIC_API_BASE` to the Railway backend URL from step 6 above
3. Deploy

**After both are live:** the backend now seeds the `assets` table and starts
every ingestion/pipeline job automatically on boot (`app/scheduler.py`) —
no manual `python -m app.jobs.X` invocation needed. Schedule: `seed_assets`
runs once at startup, `ingest_market_data` hourly, `ingest_events` every
15 min, `run_pipeline` every 10 min, `track_portfolio` every 30 min. Each
job is wrapped so a failure (missing API key, bad credentials, rate limit)
is logged and skipped rather than crashing the server — check Railway's
deploy logs for `[scheduler] ... failed` lines if data isn't showing up
after a few minutes; that'll tell you which credential is missing or wrong
rather than leaving you guessing.

## Build status (against the 14-day plan)

- [x] Days 1-2 — repo foundation, schema, DB models, config, Bitget/Qwen client skeletons
- [x] Agents 1-6 scaffolded with real logic (not stubs) — Sentinel, Interpreter,
      Relationship Hunter, Alpha Analyst, Risk Analyst + Risk Gate, Narrator
- [x] Quant engine — correlation, lead/lag, displacement, momentum, volume
      abnormality, regime classification, Alpha Score composition
- [x] API — signals, market/live, market/map, simulate, outcome close
- [x] Days 3-4 — `jobs/seed_assets.py` + `jobs/ingest_market_data.py`
      (real Bitget candle pulls into `market_data`)
- [x] Days 5-6 — `jobs/ingest_events.py` (NewsAPI headlines -> Sentinel -> Interpreter)
- [x] Days 7-8 — `quant/historical_analogues.py` — real analogue search over
      ingested price history, feeds `expected_reaction()` and the Opportunity
      Card's historical-evidence block (`reason_json.historical_analogues`)
- [x] Day 9 — `jobs/run_pipeline.py` — full orchestration: pending events ->
      Interpreter -> Relationship Hunter -> Alpha Analyst -> Risk Analyst
      (advisory) -> Risk Gate (enforcement) -> Narrator -> finished Signal row
- [x] Day 10 — frontend: dashboard, force-directed market map, Opportunity Cards,
      causal chain panel, simulation + trade autopsy flow (Next.js 14, Tailwind,
      d3-force). Dark data-terminal design system, not a template default.
- [x] Day 11 — backtesting harness (`jobs/run_backtest.py`) — real walk-forward
      validation of the displacement relationship, `in_sample`/`out_of_sample`
      split matching the handbook's 60/30-day convention, `/backtest` API routes.
      Produces zero results until real backfill exists — does not fabricate data.
- [ ] Day 12 — self-improvement loop validation (factor weight updates are
      implemented in `routes_simulate.py::_update_factor_weights`, needs
      real outcome data to prove out)
- [ ] Day 13 — demo polish
- [ ] Day 14 — submission

## Notes / open items

- **Track scope decision needed:** per the S2 handbook, a team may submit to
  at most 2 themes, each as an independent project via a separate form. Oracle
  X can't be one entry across all three tracks (Alpha Factory + Agentic
  Trading + AI Trading Desk) — pick which 1-2 to actually target, since each
  has different required materials (Alpha Factory: 60-day backtest,
  30-day out-of-sample; Agentic Trading: runnable demo + ≥2-week paper
  trading log; AI Trading Desk: one complete research-task demo).
- `place_order()` is intentionally left unimplemented until Risk Gate is
  fully proven out in the demo — no order path should exist without it.
- Qwen endpoint/model now match the hackathon-provided values
  (`https://hackathon.bitgetops.com/v1`, `qwen3.8-max`) instead of a generic
  DashScope default — set `QWEN_API_KEY` to the value issued for
  `BITGET_QWEN_API_KEY` per the handbook's setup guide.
- **Gap fixes (previously flagged, now addressed):**
  - Portfolio state: `jobs/track_portfolio.py` now pulls real account
    equity via `BitgetClient.get_account_overview()` and computes daily
    P&L / drawdown from stored snapshots — replaces the hardcoded
    placeholder in `run_pipeline.py`. Account response field names
    (`usdtEquity`, `available`, `unrealizedPL`) are defensive guesses;
    confirm against a live API response and adjust `take_snapshot()`.
  - Backfill depth: handbook's actual requirement is 60 days total /
    30 days out-of-sample (far less than the "6-12 months" originally
    flagged) — `ingest_market_data.py --backfill` targets 90 days as
    buffer. Pagination itself isn't fully wired yet: `get_candles()`
    needs an `endTime`/cursor param added once its exact name/units are
    confirmed against a live Bitget response (docs are inconsistent
    across endpoints on this).
  - Symbol resolution: `BitgetClient.resolve_symbol()` now queries the
    real `/api/v2/mix/market/contracts` list instead of guessing
    `{SYMBOL}USDT` — `ingest_market_data.py` uses it and skips/logs any
    asset in the config universe that isn't actually listed.
- Bitget's **Agent Hub** (MCP/CLI/89 UTA v3 tools, see handbook Chapter V)
  is the officially recommended integration path, especially for the
  Agentic Trading track's required paper-trading log — it's built for
  AI coding tools (Claude Code, Cursor, Codex) rather than a standalone
  Python backend, so this repo talks to Bitget via direct signed REST
  calls instead. Worth revisiting if Agent Hub's paper-trading mode turns
  out to produce better-formatted logs than what `track_portfolio.py`
  captures on its own.
