"use client";

import { useState } from "react";
import { apiPost } from "../lib/api";
import { SOCIAL_LINKS } from "./SocialLinks";

const SCENARIOS = [
  { label: "28 weeks, mild headaches", value: "I'm 28 weeks pregnant and have had mild headaches for the past 3 days, worse in the afternoon. Sleeping okay, drinking less water than usual.", mode: "report" },
  { label: "6 weeks postpartum, need a leave extension letter", value: "I'm 6 weeks postpartum and my doctor recommended 2 more weeks before returning to work due to a slow-healing C-section incision.", mode: "letter" },
];

export default function DemoBox() {
  const [customText, setCustomText] = useState("");
  const [mode, setMode] = useState("report");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function runDemo(scenarioText, scenarioMode) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiPost("/demo/generate", {
        scenario: scenarioText,
        mode: scenarioMode,
      });
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" id="demo">
      <p style={{ marginTop: 0, fontSize: 14, color: "var(--muted)", fontWeight: 600 }}>
        Try it now. No account, nothing saved.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {SCENARIOS.map((s) => (
          <button
            key={s.label}
            className="pill"
            style={{ border: "none" }}
            onClick={() => runDemo(s.value, s.mode)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <textarea
        rows={3}
        placeholder="Or describe your own situation..."
        value={customText}
        onChange={(e) => setCustomText(e.target.value)}
      />

      <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
        <select value={mode} onChange={(e) => setMode(e.target.value)} style={{ width: "auto" }}>
          <option value="report">Generate a report</option>
          <option value="letter">Draft a letter</option>
        </select>
        <button
          className="btn-primary"
          disabled={!customText || loading}
          onClick={() => runDemo(customText, mode)}
        >
          {loading ? "Generating..." : "Generate"}
        </button>
      </div>

      {error && <p style={{ color: "#a33", marginTop: 12 }}>{error}</p>}

      {result && (
        <div style={{ marginTop: 18 }}>
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "Inter", fontSize: 14, background: "var(--mist)", padding: 14, borderRadius: 10, border: "1px solid var(--line)" }}>
{JSON.stringify(result.content, null, 2)}
          </pre>
          <div className="banner-demo">{result.banner}</div>
          <a href={SOCIAL_LINKS.okxListing}>
            <button className="btn-secondary" style={{ marginTop: 12 }}>
              Continue on OKX AI to save your history
            </button>
          </a>
        </div>
      )}
    </div>
  );
}
