"""
Agent 1 — Sentinel (spec section 12).
Job: find events. News, earnings, macro, crypto, announcements.
Writes raw events to the `events` table (pre-Interpreter — sentiment/
magnitude/affected_assets are filled in by Agent 2, not here).
"""
from datetime import datetime
from sqlalchemy.orm import Session
from app.models import Event, Asset


class Sentinel:
    def __init__(self, db: Session):
        self.db = db

    def ingest_raw_headline(self, asset_symbol: str, headline: str, source: str, event_type: str,
                             timestamp: datetime = None) -> Event:
        """
        Persist a raw, unstructured event. Source feed integration (news API,
        RSS, Bitget announcements, etc.) plugs in here — this method is the
        single entry point everything upstream should call.
        """
        asset = self.db.query(Asset).filter(Asset.symbol == asset_symbol).first()
        event = Event(
            timestamp=timestamp or datetime.utcnow(),
            asset_id=asset.id if asset else None,
            event_type=event_type,
            headline=headline,
            raw_source=source,
        )
        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)
        return event

    def fetch_pending_for_interpretation(self, limit: int = 20):
        """Events ingested but not yet processed by the Interpreter (sentiment is null)."""
        return (
            self.db.query(Event)
            .filter(Event.sentiment.is_(None))
            .order_by(Event.timestamp.desc())
            .limit(limit)
            .all()
        )
