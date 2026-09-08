"""
Day 9 — Pipeline orchestrator.
Wires Sentinel -> Interpreter -> Relationship Hunter -> Alpha Analyst ->
Risk Analyst + Risk Gate -> Narrator into one real, callable pipeline.
This is the job that actually turns a fresh event into a finished,
explainable, risk-gated Signal row — everything upstream (ingestion jobs)
feeds this; everything downstream (API, frontend) reads its output.

Run once manually: python -m app.jobs.run_pipeline
Run continuously:  python -m app.jobs.run_pipeline --loop
"""
import sys
import time
from app.db import SessionLocal
from app.models import Event, Asset
from app.agents.sentinel import Sentinel
from app.agents.interpreter import Interpreter
from app.agents.relationship import RelationshipHunter
from app.agents.alpha import AlphaAnalyst
from app.agents.risk_analyst import RiskAnalyst
from app.agents.risk_gate import RiskGate
from app.agents.narrator import Narrator
from app.quant.historical_analogues import find_historical_pairs
from app.jobs.track_portfolio import get_live_portfolio_state

# Per-trade values still need to come from the specific signal/position
# sizing logic, not the portfolio tracker — these two remain here as the
# per-trade defaults until position-sizing logic is built out.
PER_TRADE_DEFAULTS = {
    "proposed_position_pct": 0.02,
    "stop_distance_pct": 0.018,
}


def process_event(db, event: Event) -> list:
    """Runs one already-interpreted event through the full agent chain. Returns created Signal rows."""
    hunter = RelationshipHunter(db)
    analyst = AlphaAnalyst(db)
    risk_analyst = RiskAnalyst(db)
    risk_gate = RiskGate(db)
    narrator = Narrator(db)

    candidates = hunter.find_propagation_candidates(event)
    if not candidates:
        return []

    signals = []
    for candidate in candidates[:3]:  # top 3 strongest-correlated candidates per event
        pairs = find_historical_pairs(db, event.asset_id, candidate["asset_id"])
        signal = analyst.analyze(event, candidate, pairs)

        # Advisory qualitative opinion — logged, does not gate
        try:
            opinion = risk_analyst.assess(signal)
            signal.reason_json = {**(signal.reason_json or {}), "risk_analyst_opinion": opinion}
            db.commit()
        except Exception as exc:
            print(f"    [risk_analyst skipped] {exc}")

        # The actual gate — deterministic, this is what sets risk_status
        portfolio_state = get_live_portfolio_state(db)
        risk_gate.evaluate(
            signal,
            portfolio_daily_pnl_pct=portfolio_state["daily_pnl_pct"],
            portfolio_drawdown_pct=portfolio_state["drawdown_pct"],
            proposed_position_pct=PER_TRADE_DEFAULTS["proposed_position_pct"],
            stop_distance_pct=PER_TRADE_DEFAULTS["stop_distance_pct"],
        )

        try:
            narrator.narrate(signal)
        except Exception as exc:
            print(f"    [narrator skipped] {exc}")

        signals.append(signal)
        print(f"    -> signal {signal.id} {candidate['symbol']} {signal.direction} "
              f"alpha={signal.alpha_score} risk={signal.risk_status}")

    return signals


def run_once():
    db = SessionLocal()
    sentinel = Sentinel(db)
    interpreter = Interpreter(db)
    try:
        pending = sentinel.fetch_pending_for_interpretation(limit=20)
        if pending:
            print(f"interpreting {len(pending)} pending events...")
            interpreter.interpret_batch(pending)

        # process recently interpreted events that don't have signals yet
        recent = (
            db.query(Event)
            .filter(Event.sentiment.isnot(None), Event.asset_id.isnot(None))
            .order_by(Event.timestamp.desc())
            .limit(20)
            .all()
        )
        total_signals = 0
        for event in recent:
            asset = db.query(Asset).get(event.asset_id)
            print(f"processing event {event.id} ({asset.symbol if asset else '?'}): {event.headline[:60]}")
            signals = process_event(db, event)
            total_signals += len(signals)
        print(f"pipeline run complete: {total_signals} signals produced")
    finally:
        db.close()


if __name__ == "__main__":
    if "--loop" in sys.argv:
        while True:
            run_once()
            time.sleep(600)  # every 10 min
    else:
        run_once()
