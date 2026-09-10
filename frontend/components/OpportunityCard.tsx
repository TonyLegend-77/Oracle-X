"use client";

import { useEffect, useRef } from "react";
import { Signal, api } from "@/lib/api";

function fmtPct(v: number | null, decimals = 2) {
  if (v === null || v === undefined) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${(v * 100).toFixed(decimals)}%`;
}

function AlphaGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 30;
  const offset = circumference * (1 - score / 100);

  return (
    <div className="alpha-gauge">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
        <circle
          cx="36" cy="36" r="30" fill="none" stroke="#F0A93E" strokeWidth="5"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        />
      </svg>
      <span className="num mono">{Math.round(score)}</span>
    </div>
  );
}

function RiskBadge({ status }: { status: Signal["risk_status"] }) {
  if (status === "PASS") return <span className="risk-badge pass mono">RISK GATE · PASS</span>;
  if (status === "BLOCK") return <span className="risk-badge block mono">RISK GATE · BLOCKED</span>;
  return <span className="risk-badge pending mono">RISK GATE · PENDING</span>;
}

export default function OpportunityCard({ signal, onSimulate }: { signal: Signal; onSimulate?: () => void }) {
  const analogues = signal.reason?.historical_analogues;
  const delivered = useRef(false);

  useEffect(() => {
    if (delivered.current) return;
    delivered.current = true;
    api.logDelivery(signal.id, "delivered").catch(() => {});
  }, [signal.id]);

  function handleExecuteClick() {
    api.logDelivery(signal.id, "execution_clicked").catch(() => {});
  }

  return (
    <div className="card">
      <div className="card-top">
        <div>
          <div className="card-title">
            <span className="sym mono">{signal.asset}</span>
            <span className={`dir mono ${signal.direction === "LONG" ? "up" : "down"}`}>{signal.direction}</span>
          </div>
          <div className="card-meta">
            <span>Confidence {signal.confidence.toFixed(0)}%</span>
            <span className="sep">·</span>
            <span>{new Date(signal.timestamp).toLocaleTimeString()}</span>
          </div>
        </div>
        <AlphaGauge score={signal.alpha_score} />
      </div>

      <div className="hr" />

      <div className="grid2 mono">
        <div>
          <div className="l">EXPECTED MOVE</div>
          <div className="v">{fmtPct(signal.expected_move_pct)}</div>
        </div>
        <div>
          <div className="l">DISPLACEMENT</div>
          <div className="v">{fmtPct(signal.displacement_pct)}</div>
        </div>
      </div>

      {(signal.agent_reasoning?.narrator || signal.agent_reasoning?.risk_analyst) && (
        <div className="agent-reasoning">
          {signal.agent_reasoning.narrator && (
            <div className="agent-block">
              <div className="agent-tag">
                <span className="qdot" />
                {signal.agent_reasoning.narrator.agent}
              </div>
              <p className="agent-text">{signal.agent_reasoning.narrator.text}</p>
            </div>
          )}
          {signal.agent_reasoning.risk_analyst && (
            <div className="agent-block">
              <div className="agent-tag">
                <span className="qdot" />
                {signal.agent_reasoning.risk_analyst.agent}
                {signal.agent_reasoning.risk_analyst.recommendation && (
                  <span className={`risk-rec ${signal.agent_reasoning.risk_analyst.recommendation.toLowerCase()}`}>
                    {signal.agent_reasoning.risk_analyst.recommendation}
                  </span>
                )}
              </div>
              <p className="agent-text">{signal.agent_reasoning.risk_analyst.reasoning}</p>
            </div>
          )}
        </div>
      )}

      {analogues && analogues.similar_events > 0 && (
        <div className="analogues">
          <span>{analogues.similar_events} historical analogues</span>
          <span style={{ color: "var(--text-muted)" }}>·</span>
          <span>{analogues.follow_through_rate}% follow-through</span>
        </div>
      )}

      <div className="card-footer">
        <RiskBadge status={signal.risk_status} />
        <div className="btn-row">
          {signal.execution_url && (
            <a href={signal.execution_url} target="_blank" rel="noopener noreferrer" onClick={handleExecuteClick} className="exec-btn mono">
              Bitget ↗
            </a>
          )}
          {signal.risk_status === "PASS" && onSimulate && (
            <button onClick={onSimulate} className="sim-btn mono">
              Simulate
            </button>
          )}
        </div>
      </div>
      {signal.risk_status === "BLOCK" && signal.risk_reason && (
        <p style={{ marginTop: 8, fontSize: 12.5, color: "var(--text-muted)" }}>Blocked: {signal.risk_reason}</p>
      )}
      <p className="gate-footnote">Risk Gate is deterministic (non-AI) — Qwen reasons, code decides.</p>
    </div>
  );
}
