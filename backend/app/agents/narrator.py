"""
Agent 6 — Narrator (spec section 12).
Qwen turns raw model output into the human-readable causal-chain
explanation shown on the Opportunity Card and the WHY? panel.
"""
from sqlalchemy.orm import Session
from app.models import Signal, Asset
from app.data.qwen_client import QwenClient
from app.quant.correlation import correlation_shift


class Narrator:
    def __init__(self, db: Session, qwen: QwenClient = None):
        self.db = db
        self.qwen = qwen or QwenClient()

    def narrate(self, signal: Signal) -> str:
        asset = self.db.query(Asset).get(signal.asset_id)
        context = {
            "asset": asset.symbol if asset else None,
            "direction": signal.direction,
            "alpha_score": float(signal.alpha_score),
            "confidence": float(signal.confidence),
            "expected_move_pct": float(signal.expected_move_pct or 0),
            "current_move_pct": float(signal.current_move_pct or 0),
            "displacement_pct": float(signal.displacement_pct or 0),
            "risk_status": signal.risk_status,
            "reason_json": signal.reason_json,
        }
        narrative = self.qwen.explain_causal_chain(context)
        signal.narrative = narrative
        self.db.commit()
        return narrative

    def what_changed(self, signal: Signal) -> str:
        """Powers the 'WHY?' / 'What Changed?' button (spec section 9)."""
        reason = signal.reason_json or {}
        before = {"correlation": None, "note": "pre-event baseline"}
        after = {"correlation": reason.get("correlation"), "note": "post-event"}
        return self.qwen.explain_what_changed(before, after)
