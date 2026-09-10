"""
SQLAlchemy ORM models — mirrors backend/db/schema.sql exactly.
Run schema.sql directly against Postgres for DDL; these models are for
application-level reads/writes (no migrations tool wired yet — add
Alembic once the schema stabilizes past hackathon v1).
"""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, BigInteger, String, Numeric, TIMESTAMP, Text, Boolean,
    ForeignKey, ARRAY, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from app.db import Base


class Asset(Base):
    __tablename__ = "assets"
    id = Column(Integer, primary_key=True)
    symbol = Column(String(20), unique=True, nullable=False)
    asset_type = Column(String(20), nullable=False)  # crypto | tokenized_equity | index
    sector = Column(String(50))
    display_name = Column(String(100))
    created_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)


class MarketData(Base):
    __tablename__ = "market_data"
    id = Column(BigInteger, primary_key=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    timeframe = Column(String(5), nullable=False)
    timestamp = Column(TIMESTAMP(timezone=True), nullable=False)
    open = Column(Numeric(20, 8), nullable=False)
    high = Column(Numeric(20, 8), nullable=False)
    low = Column(Numeric(20, 8), nullable=False)
    close = Column(Numeric(20, 8), nullable=False)
    volume = Column(Numeric(24, 8), nullable=False)


class Event(Base):
    __tablename__ = "events"
    id = Column(BigInteger, primary_key=True)
    timestamp = Column(TIMESTAMP(timezone=True), nullable=False)
    asset_id = Column(Integer, ForeignKey("assets.id"))
    event_type = Column(String(50), nullable=False)
    headline = Column(Text, nullable=False)
    raw_source = Column(Text)
    sentiment = Column(String(10))
    magnitude = Column(Numeric(4, 3))
    horizon_hours = Column(Integer)
    affected_assets = Column(ARRAY(Integer))
    created_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)


class RelationshipEdge(Base):
    __tablename__ = "relationships"
    id = Column(Integer, primary_key=True)
    asset_a_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    asset_b_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    correlation = Column(Numeric(5, 4))
    lead_lag_hours = Column(Numeric(6, 2))
    period_start = Column(TIMESTAMP(timezone=True))
    period_end = Column(TIMESTAMP(timezone=True))
    computed_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)


class Signal(Base):
    __tablename__ = "signals"
    id = Column(BigInteger, primary_key=True)
    timestamp = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    triggering_event_id = Column(BigInteger, ForeignKey("events.id"))
    direction = Column(String(5), nullable=False)  # LONG | SHORT
    alpha_score = Column(Numeric(5, 2), nullable=False)
    confidence = Column(Numeric(5, 2), nullable=False)
    expected_move_pct = Column(Numeric(8, 4))
    current_move_pct = Column(Numeric(8, 4))
    displacement_pct = Column(Numeric(8, 4))
    reason_json = Column(JSONB)
    narrative = Column(Text)
    risk_status = Column(String(10), default="PENDING")  # PASS | BLOCK | PENDING
    risk_reason = Column(Text)
    status = Column(String(15), default="OPEN")


class Simulation(Base):
    __tablename__ = "simulations"
    id = Column(BigInteger, primary_key=True)
    signal_id = Column(BigInteger, ForeignKey("signals.id"), nullable=False)
    entry_price = Column(Numeric(20, 8))
    stop_price = Column(Numeric(20, 8))
    target_price = Column(Numeric(20, 8))
    risk_amount = Column(Numeric(20, 8))
    reward_amount = Column(Numeric(20, 8))
    risk_reward = Column(Numeric(6, 3))
    historical_win_rate = Column(Numeric(5, 2))
    created_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)


class Outcome(Base):
    __tablename__ = "outcomes"
    id = Column(BigInteger, primary_key=True)
    signal_id = Column(BigInteger, ForeignKey("signals.id"), unique=True, nullable=False)
    actual_return_pct = Column(Numeric(8, 4))
    prediction_error_pct = Column(Numeric(8, 4))
    result_summary = Column(Text)
    correct_factors = Column(ARRAY(Text))
    missed_factors = Column(ARRAY(Text))
    closed_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)


class FactorWeight(Base):
    __tablename__ = "factor_weights"
    id = Column(Integer, primary_key=True)
    factor_name = Column(String(50), unique=True, nullable=False)
    weight = Column(Numeric(5, 4), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    update_reason = Column(Text)


class PortfolioSnapshot(Base):
    __tablename__ = "portfolio_snapshots"
    id = Column(BigInteger, primary_key=True)
    timestamp = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    equity = Column(Numeric(24, 8), nullable=False)
    available = Column(Numeric(24, 8))
    unrealized_pnl = Column(Numeric(24, 8))
    raw_json = Column(JSONB)


class BacktestResult(Base):
    __tablename__ = "backtest_results"
    id = Column(BigInteger, primary_key=True)
    run_id = Column(String(40), nullable=False)
    leader_asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    follower_asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    event_timestamp = Column(TIMESTAMP(timezone=True), nullable=False)
    leader_move_pct = Column(Numeric(8, 4), nullable=False)
    predicted_move_pct = Column(Numeric(8, 4), nullable=False)
    actual_move_pct = Column(Numeric(8, 4), nullable=False)
    direction_correct = Column(Boolean, nullable=False)
    in_sample = Column(Boolean, nullable=False)
    r_squared_at_time = Column(Numeric(5, 4))
    created_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)


class JobStatus(Base):
    __tablename__ = "job_status"
    job_name = Column(String(50), primary_key=True)
    last_run_at = Column(TIMESTAMP(timezone=True))
    last_success_at = Column(TIMESTAMP(timezone=True))
    last_error = Column(Text)
    last_result = Column(Text)
    run_count = Column(Integer, default=0)


class DeliveryLog(Base):
    __tablename__ = "delivery_log"
    id = Column(BigInteger, primary_key=True)
    signal_id = Column(BigInteger, ForeignKey("signals.id"), nullable=False)
    event_type = Column(String(20), nullable=False)  # delivered | execution_clicked
    channel = Column(String(20), default="dashboard")
    metadata_json = Column(JSONB)
    created_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)


class RiskGateLog(Base):
    __tablename__ = "risk_gate_log"
    id = Column(BigInteger, primary_key=True)
    signal_id = Column(BigInteger, ForeignKey("signals.id"))
    passed = Column(Boolean, nullable=False)
    checks_json = Column(JSONB, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)
