"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// Mirrors the "Live Protocol Activity" pattern: real numbers, not placeholders.
// Falls back to a quiet loading state rather than fake data if the API isn't
// reachable yet, since made-up numbers on a health product erode trust fast.
export default function StatsStrip() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/stats/public`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  const items = [
    { label: "Reports generated", value: stats?.reports ?? "—" },
    { label: "Letters drafted", value: stats?.letters ?? "—" },
    { label: "Demo tries", value: stats?.demoRuns ?? "—" },
  ];

  return (
    <div className="stats-strip">
      {items.map((i) => (
        <div className="stat-card" key={i.label}>
          <div className="value">{i.value}</div>
          <div className="label">{i.label}</div>
        </div>
      ))}
    </div>
  );
}
