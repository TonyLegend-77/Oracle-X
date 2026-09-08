"use client";

import { useEffect, useState } from "react";
import { api, MarketMapData, Signal } from "@/lib/api";
import MarketMap from "@/components/MarketMap";
import CausalChain from "@/components/CausalChain";

export default function MarketMapPage() {
  const [map, setMap] = useState<MarketMapData | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [selected, setSelected] = useState<Signal | null>(null);

  useEffect(() => {
    Promise.all([api.marketMap(), api.signals()])
      .then(([m, s]) => {
        setMap(m);
        setSignals(s);
        if (s.length > 0) setSelected(s[0]);
      })
      .catch(() => {});
  }, []);

  const activePath = map?.nodes
    .filter((n) => selected && [selected.asset].includes(n.symbol))
    .map((n) => n.id);

  return (
    <div className="flex h-full">
      <div className="flex-1 border-r hairline">
        {map && map.nodes.length > 0 ? (
          <MarketMap data={map} activePath={activePath} />
        ) : (
          <div className="flex h-full items-center justify-center text-data-sm text-text-muted">
            No relationship data yet — run the pipeline to populate the graph
          </div>
        )}
      </div>

      <div className="flex w-96 shrink-0 flex-col">
        <div className="border-b hairline px-6 py-3">
          <span className="text-data-sm text-text-secondary">Information Flow</span>
        </div>

        <div className="flex gap-2 overflow-x-auto border-b hairline px-4 py-2">
          {signals.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelected(s)}
              className={`shrink-0 border px-2.5 py-1 font-mono text-data-sm ${
                selected?.id === s.id
                  ? "border-signal text-signal"
                  : "border-border text-text-secondary hover:text-text-primary"
              }`}
            >
              {s.asset}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6">
          {selected ? (
            <>
              <CausalChain signal={selected} />
              {selected.narrative && (
                <p className="mt-6 text-sm leading-relaxed text-text-secondary">{selected.narrative}</p>
              )}
            </>
          ) : (
            <p className="text-data-sm text-text-muted">Select a signal to see its causal chain</p>
          )}
        </div>
      </div>
    </div>
  );
}
