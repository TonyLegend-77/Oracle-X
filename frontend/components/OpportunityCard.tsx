"use client";

import { useEffect, useRef } from "react";
import { Signal, api } from "@/lib/api";

function fmtPct(v: number | null, decimals = 2) {
  if (v === null || v === undefined) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${(v * 100).toFixed(decimals)}%`;
}

function AlphaGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 26;
  const offset = circumference * (1 - score / 100);
  const color = score >= 75 ? "#E8A33D" : score >= 40 ? "#8B93A7" : "#565E6D";

  return (
    <div className="relative flex h-16 w-16 items-center justify-center">
      <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
        <circle cx="32" cy="32" r="26" fill="none" stroke="#242A33" strokeWidth="4" />
        <circle
          cx="32"
          cy="32"
          r="26"
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute font-mono text-data-md tabular text-text-primary">
        {Math.round(score)}
      </span>
    </div>
  );
}

function RiskBadge({ status }: { status: Signal["risk_status"] }) {
  if (status === "PASS") {
    return (
      <span className="border border-pass/40 bg-pass/10 px-2 py-0.5 font-mono text-[11px] text-pass">
        RISK GATE — PASS
      </span>
    );
  }
  if (status === "BLOCK") {
    return (
      <span className="border border-block/40 bg-block/10 px-2 py-0.5 font-mono text-[11px] text-block">
        RISK GATE — BLOCKED
      </span>
    );
  }
  return (
    <span className="border border-border-bright bg-panel px-2 py-0.5 font-mono text-[11px] text-text-muted">
      RISK GATE — PENDING
    </span>
  );
}

export default function OpportunityCard({ signal, onSimulate }: { signal: Signal; onSimulate?: () => void }) {
  const directionColor = signal.direction === "LONG" ? "text-long" : "text-short";
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
    <div className="border hairline bg-panel p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-data-lg text-text-primary">{signal.asset}</span>
            <span className={`font-mono text-data-md font-medium ${directionColor}`}>
              {signal.direction}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-data-sm text-text-secondary">
            <span>Confidence {signal.confidence.toFixed(0)}%</span>
            <span className="text-text-muted">·</span>
            <span>{new Date(signal.timestamp).toLocaleTimeString()}</span>
          </div>
        </div>
        <AlphaGauge score={signal.alpha_score} />
      </div>

      <div className="my-4 h-px bg-border" />

      <div className="grid grid-cols-2 gap-4 font-mono text-data-sm tabular">
        <div>
          <div className="text-text-muted">Expected move</div>
          <div className="text-text-primary">{fmtPct(signal.expected_move_pct)}</div>
        </div>
        <div>
          <div className="text-text-muted">Current displacement</div>
          <div className="text-text-primary">{fmtPct(signal.displacement_pct)}</div>
        </div>
      </div>

      {signal.narrative && (
        <div className="mt-4">
          <div className="mb-1 text-data-sm text-text-muted">Why</div>
          <p className="text-sm leading-relaxed text-text-secondary">{signal.narrative}</p>
        </div>
      )}

      {analogues && analogues.similar_events > 0 && (
        <div className="mt-4 flex items-center gap-4 border-l-2 border-border-bright pl-3 text-data-sm text-text-secondary">
          <span>{analogues.similar_events} historical analogues</span>
          <span className="text-text-muted">·</span>
          <span>{analogues.follow_through_rate}% follow-through</span>
        </div>
      )}

      <div className="mt-5 flex items-center justify-between">
        <RiskBadge status={signal.risk_status} />
        <div className="flex items-center gap-2">
          {signal.risk_status === "PASS" && onSimulate && (
            <button
              onClick={onSimulate}
              className="border border-signal/40 px-3 py-1.5 font-mono text-data-sm text-signal transition-colors hover:bg-signal/10"
            >
              Simulate trade
            </button>
          )}
          {signal.execution_url && (
            <a
              href={signal.execution_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleExecuteClick}
              className="border border-border-bright px-3 py-1.5 font-mono text-data-sm text-text-primary transition-colors hover:border-signal hover:text-signal"
            >
              Trade on Bitget ↗
            </a>
          )}
        </div>
      </div>
      {signal.risk_status === "BLOCK" && signal.risk_reason && (
        <p className="mt-2 text-data-sm text-text-muted">Blocked: {signal.risk_reason}</p>
      )}
    </div>
  );
}
