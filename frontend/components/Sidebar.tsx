"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api, MarketTick } from "@/lib/api";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/market-map", label: "Information Flow" },
  { href: "/signals", label: "Signals" },
  { href: "/news", label: "News" },
  { href: "/simulation", label: "Simulations" },
];

function fmtPct(v: number) {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${(v * 100).toFixed(2)}%`;
}

export default function Sidebar() {
  const pathname = usePathname();
  const [ticks, setTicks] = useState<MarketTick[]>([]);

  useEffect(() => {
    let mounted = true;
    api
      .liveMarket()
      .then((data) => mounted && setTicks(data))
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <aside className="sidebar">
      <Link href="/dashboard" className="brand">
        <span className="dot" />
        <span className="mono">ORACLE X</span>
      </Link>

      <nav className="nav">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className={pathname === item.href ? "active" : ""}>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="watchlist-label">Watchlist</div>
      <div className="watchlist">
        {ticks.length === 0 && (
          <p style={{ padding: "0 10px", fontSize: 12.5, color: "var(--text-muted)" }}>
            No market data yet
          </p>
        )}
        {ticks.map((t) => (
          <div key={t.symbol} className="tick">
            <span className="sym mono">{t.symbol}</span>
            <span className={`chg mono tabular ${t.change_pct >= 0 ? "up" : "down"}`}>
              {fmtPct(t.change_pct)}
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}
