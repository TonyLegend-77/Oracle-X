"""
Agent 5a — Risk Analyst (advisory layer of Risk Guardian, spec section 12).
Qwen-assisted reasoning about qualitative risk factors that pure numeric
checks can't catch (e.g. "this looks like a stale correlation" or "this
event type has historically been unreliable"). This agent can RECOMMEND
a block, but cannot itself pass or fail a signal — that authority belongs
only to risk_gate.py's deterministic checks. Keeping these separate is
intentional: an LLM's judgment is a useful second opinion, not the actual
safety boundary.
"""
from sqlalchemy.orm import Session
from app.models import Signal
from app.data.qwen_client import QwenClient


class RiskAnalyst:
    def __init__(self, db: Session, qwen: QwenClient = None):
        self.db = db
        self.qwen = qwen or QwenClient()

    def assess(self, signal: Signal) -> dict:
        """
        Returns {"recommendation": "PROCEED"|"CAUTION"|"AVOID", "reasoning": str}.
        Advisory only — logged onto the signal but does not set risk_status.
        """
        context = {
            "alpha_score": float(signal.alpha_score),
            "confidence": float(signal.confidence),
            "direction": signal.direction,
            "reason_json": signal.reason_json,
        }
        system = (
            "You are Oracle X's Risk Analyst. You give a qualitative second "
            "opinion on a trading signal already scored by the quant engine. "
            "Respond ONLY with JSON: {\"recommendation\": \"PROCEED\"|\"CAUTION\"|"
            "\"AVOID\", \"reasoning\": \"<one or two sentences>\"}. You are advisory "
            "only — the deterministic Risk Gate makes the actual pass/block "
            "decision, so focus on qualitative concerns (data staleness, "
            "unusual event types, thin historical basis) rather than restating "
            "numeric thresholds."
        )
        import json
        raw = self.qwen._chat(system, json.dumps(context), json_mode=True)
        return json.loads(raw)
