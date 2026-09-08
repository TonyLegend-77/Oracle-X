"""
Agent 3 — Relationship Hunter (spec section 12).
Looks for: correlations, lead/lag, sector relationships, crypto/equity
relationships, abnormal divergence. Writes to `relationships` and returns
candidate propagation paths for the Alpha Analyst to score.
"""
import pandas as pd
from sqlalchemy.orm import Session
from app.models import Asset, MarketData, RelationshipEdge, Event
from app.quant.correlation import rolling_correlation, lead_lag_hours
from app import config


class RelationshipHunter:
    def __init__(self, db: Session):
        self.db = db

    def _price_series(self, asset_id: int, timeframe: str = "1h") -> pd.Series:
        rows = (
            self.db.query(MarketData)
            .filter(MarketData.asset_id == asset_id, MarketData.timeframe == timeframe)
            .order_by(MarketData.timestamp.asc())
            .all()
        )
        if not rows:
            return pd.Series(dtype=float)
        return pd.Series(
            [float(r.close) for r in rows], index=[r.timestamp for r in rows]
        )

    def same_sector_candidates(self, symbol: str) -> list[str]:
        sector = config.SECTOR_MAP.get(symbol)
        if not sector:
            return []
        return [s for s, sec in config.SECTOR_MAP.items() if sec == sector and s != symbol]

    def find_propagation_candidates(self, source_event: Event) -> list[dict]:
        """
        Given a triggering event on one asset, find downstream candidates:
        same-sector peers + assets already flagged by Qwen (affected_assets)
        + index proxies (SPY/QQQ) + crypto risk-proxy (BTC), each scored by
        rolling correlation and lead/lag with the source asset.
        """
        source_asset = self.db.query(Asset).filter(Asset.id == source_event.asset_id).first()
        if not source_asset:
            return []

        candidate_symbols = set(self.same_sector_candidates(source_asset.symbol))
        if source_event.affected_assets:
            affected = self.db.query(Asset).filter(Asset.id.in_(source_event.affected_assets)).all()
            candidate_symbols.update(a.symbol for a in affected)
        candidate_symbols.update(["SPY", "QQQ"])
        candidate_symbols.discard(source_asset.symbol)

        source_series = self._price_series(source_asset.id)
        results = []
        for symbol in candidate_symbols:
            candidate = self.db.query(Asset).filter(Asset.symbol == symbol).first()
            if not candidate:
                continue
            candidate_series = self._price_series(candidate.id)
            if source_series.empty or candidate_series.empty:
                continue

            corr_series = rolling_correlation(source_series, candidate_series)
            latest_corr = float(corr_series.dropna().iloc[-1]) if not corr_series.dropna().empty else 0.0
            lag, lag_corr = lead_lag_hours(source_series, candidate_series)

            results.append({
                "asset_id": candidate.id,
                "symbol": candidate.symbol,
                "sector": config.SECTOR_MAP.get(symbol),
                "correlation": latest_corr,
                "lead_lag_hours": lag,
                "lead_lag_corr": lag_corr,
            })

            self.db.add(RelationshipEdge(
                asset_a_id=source_asset.id,
                asset_b_id=candidate.id,
                correlation=latest_corr,
                lead_lag_hours=lag,
                period_start=source_series.index.min(),
                period_end=source_series.index.max(),
            ))
        self.db.commit()

        results.sort(key=lambda r: abs(r["correlation"]), reverse=True)
        return results
