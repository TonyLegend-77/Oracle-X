from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import routes_signals, routes_market, routes_simulate, routes_backtest

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


@app.get("/health")
def health():
    return {"status": "ok", "service": "oracle-x"}
