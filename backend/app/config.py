import os

# --- Core services ---
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg2://oracle_x:oracle_x@localhost:5432/oracle_x")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# --- Bitget ---
BITGET_API_KEY = os.getenv("BITGET_API_KEY", "")
BITGET_API_SECRET = os.getenv("BITGET_API_SECRET", "")
BITGET_API_PASSPHRASE = os.getenv("BITGET_API_PASSPHRASE", "")
BITGET_BASE_URL = os.getenv("BITGET_BASE_URL", "https://api.bitget.com")

# --- News source (event ingestion, Days 5-6) ---
# NewsAPI.org used as the default source: broad coverage, simple REST API,
# free tier sufficient for a hackathon build. Swap for a finance-specific
# feed (e.g. Benzinga, Alpha Vantage news) if rate limits become an issue.
NEWSAPI_KEY = os.getenv("NEWSAPI_KEY", "")
NEWSAPI_BASE_URL = os.getenv("NEWSAPI_BASE_URL", "https://newsapi.org/v2")

# --- Qwen (hackathon-provided endpoint per S2 handbook) ---
QWEN_API_KEY = os.getenv("QWEN_API_KEY", "")  # set as BITGET_QWEN_API_KEY per handbook, mapped here
QWEN_BASE_URL = os.getenv("QWEN_BASE_URL", "https://hackathon.bitgetops.com/v1")
QWEN_MODEL = os.getenv("QWEN_MODEL", "qwen3.8-max")

# --- Asset universe (crypto majors + tokenized US equities + indices) ---
CRYPTO_ASSETS = ["BTC", "ETH", "SOL"]
TOKENIZED_EQUITY_ASSETS = [
    "NVDA", "TSLA", "AMD", "MU", "AAPL", "MSFT", "AMZN", "GOOGL",
    "META", "NFLX", "COIN", "PLTR", "MSTR",
]
INDEX_ASSETS = ["SPY", "QQQ"]
ASSET_UNIVERSE = CRYPTO_ASSETS + TOKENIZED_EQUITY_ASSETS + INDEX_ASSETS

# --- Sector map (for Relationship Hunter / propagation paths) ---
SECTOR_MAP = {
    "NVDA": "semiconductors", "AMD": "semiconductors", "MU": "semiconductors",
    "TSLA": "auto_tech", "AAPL": "big_tech", "MSFT": "big_tech",
    "AMZN": "big_tech", "GOOGL": "big_tech", "META": "big_tech", "NFLX": "media_tech",
    "COIN": "crypto_equity", "MSTR": "crypto_equity", "PLTR": "software",
    "BTC": "crypto", "ETH": "crypto", "SOL": "crypto",
    "SPY": "index", "QQQ": "index",
}

# --- Risk Gate hard thresholds (deterministic — see app/agents/risk_gate.py) ---
RISK_LIMITS = {
    "max_position_pct_of_capital": 0.05,   # 5% max per signal
    "daily_loss_stop_pct": 0.03,           # halt new signals past 3% daily drawdown
    "max_drawdown_halt_pct": 0.10,         # hard halt at 10% drawdown
    "min_liquidity_usd_24h": 5_000_000,    # floor for tradeable liquidity
    "max_volatility_atr_pct": 0.08,        # block if ATR% exceeds this
    "min_stop_distance_pct": 0.005,        # stop can't be closer than 0.5%
}

# --- Bitget execution link (for AI Trading Desk track: AI presents analysis,
# human executes on Bitget directly — no autonomous order placement) ---
def bitget_execution_url(symbol: str, asset_type: str = "tokenized_equity") -> str:
    """
    Deep link to Bitget's trading page for a symbol. URL pattern below is
    the standard USDT-M futures page convention — verify against the live
    site during testing, since Bitget may use a distinct route for
    tokenized-equity perps specifically (not confirmed in the S2 handbook).
    """
    pair = f"{symbol}USDT"
    return f"https://www.bitget.com/futures/usdt/{pair}"


# --- Alpha Score factor weights (seeded; live values come from factor_weights table) ---
DEFAULT_FACTOR_WEIGHTS = {
    "cross_market_displacement": 0.30,
    "momentum": 0.20,
    "volume_abnormality": 0.15,
    "event_strength": 0.15,
    "historical_conditional_probability": 0.10,
    "market_regime": 0.10,
}
