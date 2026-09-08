"use client";

import { useEffect, useState } from "react";
import { api, Regime } from "@/lib/api";

const REGIME_LABEL: Record<Regime["regime"], string> = {
  RISK_ON: "Risk-On",
  RISK_OFF: "Risk-Off",
  NEUTRAL: "Neutral",
};

const REGIME_COLOR: Record<Regime["regime"], string> = {
  RISK_ON: "text-long",
  RISK_OFF: "text-short",
  NEUTRAL: "text-text-secondary",
};

export default function TopBar() {
  const [regime, setRegime] = useState<Regime | null>(null);

  useEffect(() => {
    let mounted = true;
    api
      .regime()
      .then((r) => mounted && setRegime(r))
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <header className="flex h-12 items-center justify-between border-b hairline px-6">
      <div className="flex items-center gap-6">
        <span className="text-data-sm text-text-secondary">Cross-Market Intelligence</span>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-data-sm text-text-muted">Market Regime</span>
          <span
            className={`font-mono text-data-sm font-medium ${
              regime ? REGIME_COLOR[regime.regime] : "text-text-muted"
            }`}
          >
            {regime ? REGIME_LABEL[regime.regime] : "—"}
          </span>
        </div>

        <div className="h-4 w-px bg-border" />

        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pass opacity-40" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-pass" />
          </span>
          <span className="text-data-sm text-text-secondary">Risk Gate active</span>
        </div>
      </div>
    </header>
  );
}
