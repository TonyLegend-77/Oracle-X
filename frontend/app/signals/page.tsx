"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, Signal } from "@/lib/api";
import OpportunityCard from "@/components/OpportunityCard";

const FILTERS = ["ALL", "PASS", "BLOCK", "PENDING"] as const;

export default function SignalsPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");
  const router = useRouter();

  useEffect(() => {
    api.signals().then(setSignals).catch(() => {});
  }, []);

  const filtered =
    filter === "ALL" ? signals : signals.filter((s) => s.risk_status === filter);

  async function simulate(id: number) {
    router.push(`/simulation?signal=${id}`);
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`border px-3 py-1.5 font-mono text-data-sm ${
              filter === f
                ? "border-signal text-signal"
                : "border-border text-text-secondary hover:text-text-primary"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-data-sm text-text-muted">No signals match this filter.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
          {filtered.map((s) => (
            <OpportunityCard key={s.id} signal={s} onSimulate={() => simulate(s.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
