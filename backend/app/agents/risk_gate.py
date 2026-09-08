"""
Agent 5b — Risk Gate (the enforcement layer of Risk Guardian).

This is deliberately NOT an LLM call. This is the structural boundary
discussed after reviewing NightDesk's S1 win: the block has to be a code
path a signal cannot get around, not an agent's opinion sitting in a
chain that a bug could route past.

Contract: no code anywhere in this project should call
bitget_client.place_order() or mark a signal tradeable without first
calling RiskGate.evaluate() and checking passed == True. This is the
single choke point.
"""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models import Signal, MarketData, RiskGateLog
from app import config


class RiskGate:
    def __init__(self, db: Session):
        self.db = db
        self.limits = config.RISK_LIMITS

    def _recent_atr_pct(self, asset_id: int, window: int = 14) -> float:
        rows = (
            self.db.query(MarketData)
            .filter(MarketData.asset_id == asset_id, MarketData.timeframe == "1h")
            .order_by(MarketData.timestamp.desc())
            .limit(window)
            .all()
        )
        if len(rows) < 2:
            return 0.0
        ranges = [(float(r.high) - float(r.low)) / float(r.close) for r in rows if float(r.close) > 0]
        return sum(ranges) / len(ranges) if ranges else 0.0

    def _recent_liquidity_usd(self, asset_id: int, hours: int = 24) -> float:
        rows = (
            self.db.query(MarketData)
            .filter(MarketData.asset_id == asset_id, MarketData.timeframe == "1h")
            .order_by(MarketData.timestamp.desc())
            .limit(hours)
            .all()
        )
        return sum(float(r.volume) * float(r.close) for r in rows)

    def evaluate(self, signal: Signal, portfolio_daily_pnl_pct: float, portfolio_drawdown_pct: float,
                 proposed_position_pct: float, stop_distance_pct: float) -> dict:
        """
        Runs every deterministic check from RISK_LIMITS. Returns
        {"passed": bool, "checks": {...}} and logs the full breakdown to
        risk_gate_log regardless of outcome (pass AND block both get logged
        — the demo point is showing the gate actually rejects things).
        """
        checks = {}

        checks["daily_loss_stop"] = {
            "pass": portfolio_daily_pnl_pct > -self.limits["daily_loss_stop_pct"],
            "value": portfolio_daily_pnl_pct,
            "limit": -self.limits["daily_loss_stop_pct"],
        }
        checks["max_drawdown"] = {
            "pass": portfolio_drawdown_pct < self.limits["max_drawdown_halt_pct"],
            "value": portfolio_drawdown_pct,
            "limit": self.limits["max_drawdown_halt_pct"],
        }
        checks["position_size"] = {
            "pass": proposed_position_pct <= self.limits["max_position_pct_of_capital"],
            "value": proposed_position_pct,
            "limit": self.limits["max_position_pct_of_capital"],
        }
        checks["stop_distance"] = {
            "pass": stop_distance_pct >= self.limits["min_stop_distance_pct"],
            "value": stop_distance_pct,
            "limit": self.limits["min_stop_distance_pct"],
        }

        atr_pct = self._recent_atr_pct(signal.asset_id)
        checks["volatility"] = {
            "pass": atr_pct <= self.limits["max_volatility_atr_pct"],
            "value": atr_pct,
            "limit": self.limits["max_volatility_atr_pct"],
        }

        liquidity = self._recent_liquidity_usd(signal.asset_id)
        checks["liquidity"] = {
            "pass": liquidity >= self.limits["min_liquidity_usd_24h"],
            "value": liquidity,
            "limit": self.limits["min_liquidity_usd_24h"],
        }

        passed = all(c["pass"] for c in checks.values())

        signal.risk_status = "PASS" if passed else "BLOCK"
        signal.risk_reason = None if passed else "; ".join(
            name for name, c in checks.items() if not c["pass"]
        )

        log = RiskGateLog(signal_id=signal.id, passed=passed, checks_json=checks)
        self.db.add(log)
        self.db.commit()

        return {"passed": passed, "checks": checks}
