"use client";

import { Signal } from "@/lib/api";

function fmtPct(v: number | null) {
  if (v === null || v === undefined) return "—";
  return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;
}

export default function CausalChain({ signal }: { signal: Signal }) {
  const reason = signal.reason || {};
  const leader = reason.leader_symbol as string | undefined;
  const leaderMove = reason.leader_move_pct as number | undefined;
  const correlation = reason.correlation as number | undefined;
  const band = reason.band as string | undefined;

  const steps = [
    leader ? { label: leader, sub: fmtPct(leaderMove ?? null), kind: "event" as const } : null,
    correlation !== undefined
      ? { label: "Propagation", sub: `${(correlation * 100).toFixed(0)}% correlated`, kind: "mid" as const }
      : null,
    { label: signal.asset, sub: fmtPct(signal.current_move_pct), kind: "mid" as const },
    { label: "Displacement", sub: fmtPct(signal.displacement_pct), kind: "mid" as const },
    { label: `Opportunity — ${Math.round(signal.alpha_score)}/100`, sub: band ?? signal.direction, kind: "result" as const },
  ].filter(Boolean) as { label: string; sub: string; kind: "event" | "mid" | "result" }[];

  return (
    <div className="flex flex-col items-center py-2">
      {steps.map((step, i) => (
        <div key={i} className="flex flex-col items-center">
          <div
            className={`border px-4 py-2 text-center font-mono text-data-sm ${
              step.kind === "result"
                ? "border-signal/50 bg-signal/10 text-signal"
                : step.kind === "event"
                ? "border-border-bright bg-panel text-text-primary"
                : "border-border bg-base text-text-secondary"
            }`}
          >
            <div>{step.label}</div>
            <div className="mt-0.5 text-[11px] text-text-muted">{step.sub}</div>
          </div>
          {i < steps.length - 1 && <div className="h-6 w-px bg-border" />}
        </div>
      ))}
    </div>
  );
}
