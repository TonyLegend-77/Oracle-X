"""
Runs every job automatically in the background, on repeating intervals,
starting the moment the FastAPI app boots. No manual `python -m app.jobs.X`
invocation needed — this exists specifically because there's no terminal
access in a phone-only workflow.

Each job is wrapped so a failure (missing API key, bad credentials, rate
limit, whatever) is logged and skipped rather than crashing the whole
server — one bad Bitget/Qwen/NewsAPI call shouldn't take down /health or
the other jobs.
"""
import asyncio
import traceback


async def _safe_run(name: str, func):
    try:
        await asyncio.to_thread(func)
        print(f"[scheduler] {name} completed")
    except Exception:
        print(f"[scheduler] {name} failed:")
        traceback.print_exc()


async def _run_once(name: str, func):
    await _safe_run(name, func)


async def _run_periodically(name: str, func, interval_seconds: int, run_immediately: bool = True):
    if run_immediately:
        await _safe_run(name, func)
    while True:
        await asyncio.sleep(interval_seconds)
        await _safe_run(name, func)


def start_background_jobs():
    """Call once from FastAPI startup. Fires off every job as a background
    asyncio task — seed_assets runs once, everything else loops forever."""
    from app.jobs.seed_assets import seed
    from app.jobs.ingest_market_data import run_once as ingest_market_once
    from app.jobs.ingest_events import run_once as ingest_events_once
    from app.jobs.run_pipeline import run_once as pipeline_once
    from app.jobs.track_portfolio import run_once as portfolio_once

    asyncio.create_task(_run_once("seed_assets", seed))

    # Staggered start delays so they don't all hit the DB/APIs at once on boot
    asyncio.create_task(_run_periodically("ingest_market_data", ingest_market_once, 3600))
    asyncio.create_task(_run_periodically("ingest_events", ingest_events_once, 900))
    asyncio.create_task(_run_periodically("run_pipeline", pipeline_once, 600))
    asyncio.create_task(_run_periodically("track_portfolio", portfolio_once, 1800))

    print("[scheduler] background jobs started: seed_assets (once), "
          "ingest_market_data (hourly), ingest_events (15min), "
          "run_pipeline (10min), track_portfolio (30min)")
