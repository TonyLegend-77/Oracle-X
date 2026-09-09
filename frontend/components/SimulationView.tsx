"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, Signal, SimulationResult } from "@/lib/api";

function fmt(v: number) {
  return v.toFixed(v < 10 ? 4 : 2);
}

export default function SimulationView() {
  const params = useSearchParams();
  const signalId = params.get("signal");

  const [signal, setSignal] = useState<Signal | null>(null);
  const [sim, setSim] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actualReturn, setActualReturn] = useState("");
  const [outcomeResult, setOutcomeResult] = useState<{ prediction_error_pct: number } | null>(null);

  useEffect(() => {
    if (!signalId) return;
    api.signal(Number(signalId)).then(setSignal).catch(() => {});
  }, [signalId]);

  async function runSimulation() {
    if (!signal) return;
    setError(null);
    try {
      const result = await api.simulate(signal.id);
      setSim(result);
    } catch (e) {
      setError("Simulation failed — signal must have risk_status=PASS.");
    }
  }

  async function closeOutcome() {
    if (!signal || actualReturn === "") return;
    const result = await api.closeOutcome(signal.id, {
      actual_return_pct: parseFloat(actualReturn) / 100,
      result_summary: "Manually closed from simulation view",
    });
    setOutcomeResult(result);
  }

  if (!signalId) {
    return (
      <div className="flex h-full items-center justify-center text-data-sm text-text-muted">
        Select a signal from the Signals page to simulate.
      </div>
    );
  }

  if (!signal) {
    return <div className="p-6 text-data-sm text-text-muted">Loading signal…</div>;
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-baseline gap-3">
        <span className="font-mono text-data-lg text-text-primary">{signal.asset}</span>
        <span className={`font-mono ${signal.direction === "LONG" ? "text-long" : "text-short"}`}>
          {signal.direction}
        </span>
        <span className="text-data-sm text-text-muted">Alpha {Math.round(signal.alpha_score)}</span>
      </div>

      {!sim ? (
        <div className="border hairline bg-panel p-6">
          <p className="mb-4 text-sm text-text-secondary">
            Run the Simulation Engine against current market data — entry, stop, target, and R:R
            are computed from this signal's expected move and Risk Gate's stop-distance parameters.
          </p>
          <button
            onClick={runSimulation}
            className="border border-signal/40 px-4 py-2 font-mono text-data-sm text-signal hover:bg-signal/10"
          >
            Simulate trade
          </button>
          {error && <p className="mt-3 text-data-sm text-short">{error}</p>}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-px border hairline bg-border">
            <SimStat label="Entry" value={fmt(sim.entry)} />
            <SimStat label="Stop" value={fmt(sim.stop)} accentColor="text-short" />
            <SimStat label="Target" value={fmt(sim.target)} accentColor="text-long" />
          </div>
          <div className="mt-px grid grid-cols-3 gap-px border-x border-b hairline bg-border">
            <SimStat label="Risk" value={fmt(sim.risk_amount)} />
            <SimStat label="Reward" value={fmt(sim.reward_amount)} />
            <SimStat label="R:R" value={`1:${sim.risk_reward.toFixed(1)}`} accentColor="text-signal" />
          </div>

          <div className="mt-8 border hairline bg-panel p-6">
            <h3 className="mb-3 text-data-sm text-text-secondary">Trade Autopsy</h3>
            <p className="mb-4 text-sm text-text-secondary">
              Record the actual outcome to close the loop — this feeds the factor-weight
              self-improvement update.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                step="0.01"
                placeholder="Actual return %"
                value={actualReturn}
                onChange={(e) => setActualReturn(e.target.value)}
                className="w-40 border hairline bg-base px-3 py-2 font-mono text-data-sm text-text-primary outline-none focus:border-signal"
              />
              <button
                onClick={closeOutcome}
                className="border border-border-bright px-4 py-2 font-mono text-data-sm text-text-primary hover:border-signal hover:text-signal"
              >
                Close & record outcome
              </button>
            </div>
            {outcomeResult && (
              <p className="mt-4 font-mono text-data-sm text-text-secondary">
                Prediction error: {(outcomeResult.prediction_error_pct * 100).toFixed(2)}%
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SimStat({ label, value, accentColor }: { label: string; value: string; accentColor?: string }) {
  return (
    <div className="bg-base px-5 py-4">
      <div className="text-data-sm text-text-muted">{label}</div>
      <div className={`mt-1 font-mono text-data-md tabular ${accentColor ?? "text-text-primary"}`}>{value}</div>
    </div>
  );
}
