"""
Agent 4 — Alpha Analyst (spec section 12).
Combines quantitative features into an Alpha Score and creates the Signal
row. Does NOT decide whether the signal is allowed to trade — that's
Risk Guardian's job (risk_analyst.py + risk_gate.py), run after this.
"""
import pandas as pd
from sqlalchemy.orm import Session
from app.models import Asset, MarketData, Event, Signal
from app.quant.displacement import expected_reaction, displacement_gap, displacement_zscore
from app.quant.momentum import momentum_score, volume_abnormality
from app.quant.regime import classify_regime, regime_factor_for_alpha
from app.quant.scoring import get_live_weights, compose_alpha_score, score_band
from app.quant.historical_analogues import analogue_summary


class AlphaAnalyst:
    def __init__(self, db: Session):
        self.db = db

    def _series(self, asset_id: int, field: str, timeframe: str = "1h") -> pd.Series:
        rows = (
            self.db.query(MarketData)
            .filter(MarketData.asset_id == asset_id, MarketData.timeframe == timeframe)
            .order_by(MarketData.timestamp.asc())
            .all()
        )
        if not rows:
            return pd.Series(dtype=float)
        values = [float(getattr(r, field)) for r in rows]
        return pd.Series(values, index=[r.timestamp for r in rows])

    def analyze(self, source_event: Event, candidate: dict, historical_pairs: pd.DataFrame) -> Signal:
        """
        candidate: one entry from RelationshipHunter.find_propagation_candidates()
        historical_pairs: past (leader_move_pct, follower_move_pct) analogues
        for this asset pair, used by displacement.expected_reaction().
        """
        candidate_close = self._series(candidate["asset_id"], "close")
        candidate_volume = self._series(candidate["asset_id"], "volume")

        current_move_pct = float(
            candidate_close.iloc[-1] / candidate_close.iloc[-2] - 1
        ) if len(candidate_close) > 1 else 0.0

        leader_close = self._series(source_event.asset_id, "close")
        leader_move_pct = float(
            leader_close.iloc[-1] / leader_close.iloc[-2] - 1
        ) if len(leader_close) > 1 else 0.0

        expected_move_pct, r_squared = expected_reaction(leader_move_pct, historical_pairs)
        gap = displacement_gap(expected_move_pct, current_move_pct)

        historical_gaps = (
            historical_pairs["follower_move_pct"] - historical_pairs["leader_move_pct"]
            if not historical_pairs.empty else pd.Series(dtype=float)
        )
        z = displacement_zscore(gap, historical_gaps)
        displacement_factor = min(max(abs(z) / 3, 0.0), 1.0)  # squash to 0..1

        mom = (momentum_score(candidate_close) + 1) / 2  # 0..1
        vol_abnormality = volume_abnormality(candidate_volume)

        btc_close = self._series(
            self.db.query(Asset).filter(Asset.symbol == "BTC").first().id, "close"
        )
        qqq_close = self._series(
            self.db.query(Asset).filter(Asset.symbol == "QQQ").first().id, "close"
        )
        regime = classify_regime(btc_close, qqq_close)
        regime_factor = regime_factor_for_alpha(regime)

        factors = {
            "cross_market_displacement": displacement_factor,
            "momentum": mom,
            "volume_abnormality": vol_abnormality,
            "event_strength": float(source_event.magnitude or 0.0),
            "historical_conditional_probability": r_squared,
            "market_regime": regime_factor,
        }
        weights = get_live_weights(self.db)
        alpha_score = compose_alpha_score(factors, weights)
        confidence = round(min(alpha_score, r_squared * 100 + alpha_score * 0.3), 2)

        direction = "LONG" if gap > 0 else "SHORT"
        analogues = analogue_summary(historical_pairs, leader_move_pct) if not historical_pairs.empty else {
            "similar_events": 0, "follow_through_rate": 0.0, "median_move": 0.0, "average_move": 0.0
        }

        signal = Signal(
            asset_id=candidate["asset_id"],
            triggering_event_id=source_event.id,
            direction=direction,
            alpha_score=alpha_score,
            confidence=confidence,
            expected_move_pct=expected_move_pct,
            current_move_pct=current_move_pct,
            displacement_pct=gap,
            reason_json={
                "leader_symbol": self.db.query(Asset).get(source_event.asset_id).symbol,
                "leader_move_pct": leader_move_pct,
                "correlation": candidate["correlation"],
                "lead_lag_hours": candidate["lead_lag_hours"],
                "factors": factors,
                "weights": weights,
                "band": score_band(alpha_score),
                "historical_analogues": analogues,
            },
            risk_status="PENDING",
        )
        self.db.add(signal)
        self.db.commit()
        self.db.refresh(signal)
        return signal
