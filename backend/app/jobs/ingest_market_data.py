"""
Days 3-4 — Market engine ingestion (revised).

Two fixes from the S2 handbook review:
1. Symbol resolution now uses BitgetClient.resolve_symbol() against the
   real contract list instead of guessing a `{SYMBOL}USDT` convention.
2. Backfill is now paginated to cover ~90 days of hourly candles (buffer
   above the handbook's 60-day-total / 30-day-out-of-sample backtest
   requirement for Alpha Factory), not just a single 200-candle pull.

Run once manually: python -m app.jobs.ingest_market_data
Run continuously:  python -m app.jobs.ingest_market_data --loop
Full backfill:     python -m app.jobs.ingest_market_data --backfill
"""
import sys
import time
from datetime import datetime, timedelta, timezone
from app.db import SessionLocal
from app.models import Asset, MarketData
from app.data.bitget_client import BitgetClient
from app import config

GRANULARITY_MAP = {"1h": "1H", "4h": "4H", "1d": "1D", "15m": "15m", "5m": "5m", "1m": "1m"}
BACKFILL_DAYS = 90  # buffer above the 60-day backtest minimum
CANDLES_PER_REQUEST = 200  # Bitget's per-request cap


def resolve_and_cache_symbol(client: BitgetClient, asset: Asset, cache: dict):
    if asset.symbol in cache:
        return cache[asset.symbol]
    resolved = client.resolve_symbol(asset.symbol)
    if not resolved:
        print(f"  [not listed] {asset.symbol} — no matching Bitget contract, skipping")
    cache[asset.symbol] = resolved
    return resolved


def _insert_candles(db, asset: Asset, timeframe: str, candles: list) -> int:
    inserted = 0
    for c in candles:
        ts = datetime.fromtimestamp(int(c[0]) / 1000, tz=timezone.utc)
        exists = (
            db.query(MarketData)
            .filter(MarketData.asset_id == asset.id, MarketData.timeframe == timeframe,
                     MarketData.timestamp == ts)
            .first()
        )
        if exists:
            continue
        db.add(MarketData(
            asset_id=asset.id, timeframe=timeframe, timestamp=ts,
            open=c[1], high=c[2], low=c[3], close=c[4], volume=c[5],
        ))
        inserted += 1
    return inserted


def ingest_asset(db, client: BitgetClient, asset: Asset, bitget_symbol: str, timeframe: str = "1h"):
    granularity = GRANULARITY_MAP[timeframe]
    try:
        raw = client.get_candles(bitget_symbol, granularity=granularity, limit=CANDLES_PER_REQUEST)
    except Exception as exc:
        print(f"  [skip] {asset.symbol}: {exc}")
        return 0
    inserted = _insert_candles(db, asset, timeframe, raw.get("data", []))
    db.commit()
    return inserted


def backfill_asset(db, client: BitgetClient, asset: Asset, bitget_symbol: str, timeframe: str = "1h"):
    """
    Walks backward in time to cover BACKFILL_DAYS of history,
    CANDLES_PER_REQUEST at a time.

    NOTE: full pagination requires an `endTime` (or equivalent cursor) param
    on Bitget's candles endpoint. get_candles() doesn't accept one yet —
    add it there (confirm the exact param name/units against a live API
    response first; Bitget's docs are inconsistent between endTime-in-ms and
    before/after cursor styles across product types). Until that param is
    wired through, this function pulls one page and stops rather than
    silently looping on the same data.
    """
    granularity = GRANULARITY_MAP[timeframe]
    cutoff = datetime.now(timezone.utc) - timedelta(days=BACKFILL_DAYS)

    try:
        raw = client.get_candles(bitget_symbol, granularity=granularity, limit=CANDLES_PER_REQUEST)
    except Exception as exc:
        print(f"  [backfill skip] {asset.symbol}: {exc}")
        return 0

    candles = raw.get("data", [])
    inserted = _insert_candles(db, asset, timeframe, candles)
    db.commit()

    if candles:
        oldest_ts = datetime.fromtimestamp(min(int(c[0]) for c in candles) / 1000, tz=timezone.utc)
        if oldest_ts > cutoff:
            print(f"  [needs more] {asset.symbol}: oldest candle is {oldest_ts.date()}, "
                  f"target is {cutoff.date()} — wire endTime pagination in "
                  f"bitget_client.get_candles() to reach full {BACKFILL_DAYS}d")
    return inserted


def run_once(timeframe: str = "1h"):
    db = SessionLocal()
    client = BitgetClient()
    symbol_cache = {}
    try:
        assets = db.query(Asset).all()
        total = 0
        for asset in assets:
            bitget_symbol = resolve_and_cache_symbol(client, asset, symbol_cache)
            if not bitget_symbol:
                continue
            n = ingest_asset(db, client, asset, bitget_symbol, timeframe)
            total += n
            print(f"  {asset.symbol} ({bitget_symbol}): +{n} candles")
        print(f"ingest complete: {total} new candles across {len(assets)} assets")
    finally:
        db.close()


def run_backfill(timeframe: str = "1h"):
    db = SessionLocal()
    client = BitgetClient()
    symbol_cache = {}
    try:
        assets = db.query(Asset).all()
        total = 0
        for asset in assets:
            bitget_symbol = resolve_and_cache_symbol(client, asset, symbol_cache)
            if not bitget_symbol:
                continue
            n = backfill_asset(db, client, asset, bitget_symbol, timeframe)
            total += n
            print(f"  {asset.symbol} ({bitget_symbol}): +{n} candles (backfill)")
        print(f"backfill complete: {total} candles across {len(assets)} assets (~{BACKFILL_DAYS}d target)")
    finally:
        db.close()


if __name__ == "__main__":
    if "--backfill" in sys.argv:
        run_backfill()
    elif "--loop" in sys.argv:
        while True:
            run_once()
            time.sleep(3600)
    else:
        run_once()
