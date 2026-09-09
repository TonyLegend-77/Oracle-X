from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import routes_signals, routes_market, routes_simulate, routes_backtest
from app.db_init import apply_schema

app = FastAPI(title="Oracle X", description="AI cross-market alpha engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten before Demo Day
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes_signals.router)
app.include_router(routes_market.router)
app.include_router(routes_simulate.router)
app.include_router(routes_backtest.router)


@app.on_event("startup")
def on_startup():
    try:
        apply_schema()
    except Exception as exc:
        # Log and continue rather than crash the whole app — a schema
        # apply failure (e.g. DB not reachable yet) shouldn't take down
        # /health, which is useful for debugging a bad deploy.
        print(f"schema apply failed on startup: {exc}")


@app.get("/health")
def health():
    return {"status": "ok", "service": "oracle-x"}
