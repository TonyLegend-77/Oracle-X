"""
Correlation + lead/lag engine. Feeds the `relationships` table and the
Relationship Hunter agent. Real pandas/numpy math — no stubs.
"""
import numpy as np
import pandas as pd


def rolling_correlation(series_a: pd.Series, series_b: pd.Series, window: int = 30) -> pd.Series:
    """Rolling Pearson correlation of two return series, aligned on timestamp index."""
    returns_a = series_a.pct_change()
    returns_b = series_b.pct_change()
    return returns_a.rolling(window).corr(returns_b)


def lead_lag_hours(series_a: pd.Series, series_b: pd.Series, max_lag: int = 24) -> tuple[float, float]:
    """
    Cross-correlation at multiple lags to find how many hours A leads B
    (positive = A leads B, negative = B leads A). Returns (best_lag, corr_at_best_lag).
    Series must be hourly-indexed return series.
    """
    returns_a = series_a.pct_change().dropna()
    returns_b = series_b.pct_change().dropna()

    best_lag, best_corr = 0, -1.0
    for lag in range(-max_lag, max_lag + 1):
        shifted_b = returns_b.shift(lag)
        aligned = pd.concat([returns_a, shifted_b], axis=1).dropna()
        if len(aligned) < 10:
            continue
        corr = aligned.iloc[:, 0].corr(aligned.iloc[:, 1])
        if corr is not None and abs(corr) > abs(best_corr):
            best_lag, best_corr = lag, corr
    return float(best_lag), float(best_corr)


def correlation_shift(series_a: pd.Series, series_b: pd.Series, event_timestamp, window_hours: int = 48):
    """
    Before/after correlation shift around an event (spec section 9,
    'What Changed?'). Returns (corr_before, corr_after, delta).
    """
    before_mask = (series_a.index >= event_timestamp - pd.Timedelta(hours=window_hours)) & (
        series_a.index < event_timestamp
    )
    after_mask = (series_a.index >= event_timestamp) & (
        series_a.index < event_timestamp + pd.Timedelta(hours=window_hours)
    )

    corr_before = series_a[before_mask].pct_change().corr(series_b[before_mask].pct_change())
    corr_after = series_a[after_mask].pct_change().corr(series_b[after_mask].pct_change())
    corr_before = float(corr_before) if corr_before is not None else 0.0
    corr_after = float(corr_after) if corr_after is not None else 0.0
    return corr_before, corr_after, corr_after - corr_before
