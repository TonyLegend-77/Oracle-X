"use client";

import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";

export default function PredictionsStrip() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiGet("/predictions/info?topic=maternity leave")
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="card" id="predictions">
      <p style={{ marginTop: 0, fontSize: 14, color: "var(--muted)", fontWeight: 600 }}>
        Live prediction-market context, not financial advice
      </p>

      {error && <p style={{ color: "var(--muted)", fontSize: 14 }}>Live feed unavailable right now.</p>}

      {!data && !error && <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading live markets…</p>}

      {data && (
        <>
          <div style={{ display: "grid", gap: 10 }}>
            {(data.markets || []).slice(0, 5).map((m, i) => (
              <div key={m.id || i} className="card" style={{ padding: 12 }}>
                <strong style={{ fontSize: 14 }}>{m.question || m.title || "Market"}</strong>
              </div>
            ))}
            {(!data.markets || data.markets.length === 0) && (
              <p style={{ color: "var(--muted)", fontSize: 14 }}>No open markets for this topic right now.</p>
            )}
          </div>
          <p className="disclaimer" style={{ marginTop: 12 }}>
            Source: {data.source === "live" ? "live from Polymarket" : "last known snapshot"}.{" "}
            {data.disclaimer}
          </p>
        </>
      )}
    </div>
  );
}
