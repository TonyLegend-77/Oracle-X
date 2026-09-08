"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api, MarketTick } from "@/lib/api";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/market-map", label: "Information Flow" },
  { href: "/signals", label: "Signals" },
  { href: "/simulation", label: "Simulations" },
];

function fmtPct(v: number) {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${(v * 100).toFixed(2)}%`;
}

export default function Sidebar() {
  const pathname = usePathname();
  const [ticks, setTicks] = useState<MarketTick[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    api
      .liveMarket()
      .then((data) => mounted && setTicks(data))
      .catch(() => mounted && setError(true));
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r hairline">
      <div className="flex items-center gap-2 border-b hairline px-4 py-4">
        <div className="h-2 w-2 rounded-full bg-signal" />
        <span className="font-mono text-data-sm tracking-wide text-text-primary">ORACLE X</span>
      </div>

      <nav className="flex flex-col border-b hairline py-2">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-4 py-2 text-sm transition-colors ${
                active
                  ? "border-l-2 border-signal bg-panel text-text-primary"
                  : "border-l-2 border-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span className="text-data-sm text-text-muted">Watchlist</span>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {error && (
          <p className="px-2 text-data-sm text-text-muted">Backend unreachable</p>
        )}
        {ticks.map((t) => (
          <div
            key={t.symbol}
            className="flex items-center justify-between rounded-none px-2 py-1.5 hover:bg-panel"
          >
            <span className="font-mono text-data-sm text-text-primary">{t.symbol}</span>
            <span
              className={`font-mono tabular text-data-sm ${
                t.change_pct >= 0 ? "text-long" : "text-short"
              }`}
            >
              {fmtPct(t.change_pct)}
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}
