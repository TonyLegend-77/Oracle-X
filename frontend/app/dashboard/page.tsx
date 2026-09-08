"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, Signal, MarketMapData } from "@/lib/api";
import OpportunityCard from "@/components/OpportunityCard";
import MarketMap from "@/components/MarketMap";

export default function DashboardPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [map, setMap] = useState<MarketMapData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.signals(), api.marketMap()])
      .then(([s, m]) => {
        setSignals(s);
        setMap(m);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const active = signals.filter((s) => s.status === "OPEN" || s.status === "SIMULATED");
  const highConfidence = active.filter((s) => s.alpha_score >= 75);
  const top = [...active].sort((a, b) => b.alpha_score - a.alpha_score)[0];

  return (
    <div className="grid h-full grid-cols-3 gap-px bg-border">
      {/* Stats strip spans full width */}
      <div className="col-span-3 grid grid-cols-4 gap-px bg-border">
        <Stat label="Active signals" value={active.length.toString()} />
        <Stat label="High confidence" value={highConfidence.length.toString()} accent />
        <Stat
          label="Avg alpha score"
          value={
            active.length
              ? Math.round(active.reduce((sum, s) => sum + s.alpha_score, 0) / active.length).toString()
              : "—"
          }
        />
        <Stat label="Blocked by Risk Gate" value={signals.filter((s) => s.risk_status === "BLOCK").length.toString()} />
      </div>

      <div className="col-span-2 flex flex-col bg-base">
        <div className="flex items-center justify-between border-b hairline px-6 py-3">
          <span className="text-data-sm text-text-secondary">Live Market Map</span>
          <Link href="/market-map" className="text-data-sm text-signal hover:underline">
            Open full view
          </Link>
        </div>
        <div className="flex-1">
          {map && map.nodes.length > 0 ? (
            <MarketMap data={map} />
          ) : (
            <EmptyState loading={loading} label="No market data ingested yet" />
          )}
        </div>
      </div>

      <div className="col-span-1 flex flex-col bg-base">
        <div className="border-b hairline px-6 py-3">
          <span className="text-data-sm text-text-secondary">Top Opportunity</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {top ? (
            <OpportunityCard signal={top} />
          ) : (
            <EmptyState loading={loading} label="No signals yet" />
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-base px-6 py-4">
      <div className="text-data-sm text-text-muted">{label}</div>
      <div className={`mt-1 font-mono text-data-lg tabular ${accent ? "text-signal" : "text-text-primary"}`}>
        {value}
      </div>
    </div>
  );
}

function EmptyState({ loading, label }: { loading: boolean; label: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <span className="text-data-sm text-text-muted">{loading ? "Loading…" : label}</span>
    </div>
  );
}
