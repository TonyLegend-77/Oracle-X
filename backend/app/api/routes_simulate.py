from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import Signal, Simulation, Outcome, MarketData, FactorWeight

router = APIRouter(tags=["simulation"])


@router.post("/signals/{signal_id}/simulate")
def simulate(signal_id: int, db: Session = Depends(get_db)):
    signal = db.query(Signal).get(signal_id)
    if not signal:
        raise HTTPException(404, "signal not found")
    if signal.risk_status != "PASS":
        raise HTTPException(400, f"cannot simulate a signal with risk_status={signal.risk_status}")

    latest = (
        db.query(MarketData)
        .filter(MarketData.asset_id == signal.asset_id, MarketData.timeframe == "1h")
        .order_by(MarketData.timestamp.desc())
        .first()
    )
    if not latest:
        raise HTTPException(400, "no market data for this asset")

    entry = float(latest.close)
    expected_move = float(signal.expected_move_pct or 0)
    stop_pct = 0.018  # placeholder default stop distance; tune via risk_gate min_stop_distance
    if signal.direction == "LONG":
        stop = entry * (1 - stop_pct)
        target = entry * (1 + abs(expected_move))
    else:
        stop = entry * (1 + stop_pct)
        target = entry * (1 - abs(expected_move))

    risk_amount = abs(entry - stop)
    reward_amount = abs(target - entry)
    rr = round(reward_amount / risk_amount, 3) if risk_amount > 0 else 0.0

    sim = Simulation(
        signal_id=signal.id,
        entry_price=entry,
        stop_price=stop,
        target_price=target,
        risk_amount=risk_amount,
        reward_amount=reward_amount,
        risk_reward=rr,
        historical_win_rate=None,  # filled once historical analogue engine is wired (Days 7-8)
    )
    db.add(sim)
    signal.status = "SIMULATED"
    db.commit()
    db.refresh(sim)

    return {
        "entry": entry, "stop": stop, "target": target,
        "risk_amount": risk_amount, "reward_amount": reward_amount,
        "risk_reward": rr,
    }


class CloseOutcomeRequest(BaseModel):
    actual_return_pct: float
    result_summary: str = ""
    correct_factors: list[str] = []
    missed_factors: list[str] = []


@router.post("/outcomes/{signal_id}/close")
def close_outcome(signal_id: int, body: CloseOutcomeRequest, db: Session = Depends(get_db)):
    signal = db.query(Signal).get(signal_id)
    if not signal:
        raise HTTPException(404, "signal not found")

    predicted = float(signal.expected_move_pct or 0)
    error = round(abs(predicted - body.actual_return_pct), 4)

    outcome = Outcome(
        signal_id=signal.id,
        actual_return_pct=body.actual_return_pct,
        prediction_error_pct=error,
        result_summary=body.result_summary,
        correct_factors=body.correct_factors,
        missed_factors=body.missed_factors,
    )
    db.add(outcome)
    signal.status = "CLOSED"
    db.commit()

    _update_factor_weights(db, signal, outcome)

    return {"prediction_error_pct": error}


def _update_factor_weights(db: Session, signal: Signal, outcome: Outcome):
    """
    Minimal self-improvement step (spec section 11): nudge factor weights
    for factors named in missed_factors down slightly, correct_factors up
    slightly, renormalize. This is intentionally simple/transparent for v1 —
    a more principled online-learning update can replace this later without
    changing the schema.
    """
    weights = {r.factor_name: r for r in db.query(FactorWeight).all()}
    step = 0.01

    for name in outcome.correct_factors or []:
        if name in weights:
            weights[name].weight = float(weights[name].weight) + step
            weights[name].update_reason = f"reinforced after signal {signal.id} outcome"

    for name in outcome.missed_factors or []:
        if name in weights:
            weights[name].weight = max(0.01, float(weights[name].weight) - step)
            weights[name].update_reason = f"reduced after signal {signal.id} outcome"

    total = sum(float(w.weight) for w in weights.values()) or 1.0
    for w in weights.values():
        w.weight = round(float(w.weight) / total, 4)

    db.commit()
