"use client";

import { useState } from "react";
import { apiPost, apiGet } from "../../lib/api";

const SKILLS = [
  { key: "report", label: "Report", path: "/generate/report", needsEntries: true },
  { key: "prep", label: "Prep Sheet", path: "/generate/prep", needsEntries: true },
  { key: "letter", label: "Letter", path: "/generate/letter", needsEntries: true, needsPurposeTone: true },
  {
    key: "action-items",
    label: "Action Items",
    path: "/generate/action-items",
    needsEntries: true,
    notInDemo: true,
    pitch: "Turns scattered notes into a prioritized checklist in one call.",
  },
  {
    key: "questions",
    label: "Question Bank",
    path: "/generate/questions",
    needsEntries: true,
    notInDemo: true,
    pitch: "8-12 ready-to-copy appointment questions, organized by category.",
  },
  {
    key: "debrief",
    label: "Post-Visit Debrief",
    path: "/generate/debrief",
    needsVisitNotes: true,
    notInDemo: true,
    pitch: "Captures what the provider said and the action plan while it's fresh.",
  },
];

export default function DashboardTestPage() {
  // Auth state
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [authError, setAuthError] = useState("");

  // Entry composer
  const [entryText, setEntryText] = useState("");
  const [entryStatus, setEntryStatus] = useState("");

  // Letter-specific inputs
  const [purpose, setPurpose] = useState("employer accommodation request");
  const [tone, setTone] = useState("firm");

  // Debrief-specific input
  const [visitNotes, setVisitNotes] = useState("");

  // Per-skill run state
  const [results, setResults] = useState({});
  const [loadingKey, setLoadingKey] = useState(null);
  const [errors, setErrors] = useState({});

  async function requestCode() {
    setAuthError("");
    try {
      await apiPost("/users/session/request", { email });
      setCodeSent(true);
    } catch (err) {
      setAuthError(err.message);
    }
  }

  async function verifyCode() {
    setAuthError("");
    try {
      await apiPost("/users/session/verify", { email, code });
      setLoggedIn(true);
    } catch (err) {
      setAuthError(err.message);
    }
  }

  async function addEntry() {
    if (!entryText.trim()) return;
    setEntryStatus("Saving...");
    try {
      await apiPost("/ingest", { type: "text", content: entryText });
      setEntryText("");
      setEntryStatus("Saved.");
    } catch (err) {
      setEntryStatus(`Error: ${err.message}`);
    }
  }

  async function runSkill(skill) {
    setLoadingKey(skill.key);
    setErrors((e) => ({ ...e, [skill.key]: null }));
    try {
      let body = {};
      if (skill.needsPurposeTone) body = { purpose, tone };
      if (skill.needsVisitNotes) {
        if (!visitNotes.trim()) throw new Error("Enter visit notes first");
        body = { visitNotes };
      }
      const data = await apiPost(skill.path, body);
      setResults((r) => ({ ...r, [skill.key]: data }));
    } catch (err) {
      setErrors((e) => ({ ...e, [skill.key]: err.message }));
    } finally {
      setLoadingKey(null);
    }
  }

  if (!loggedIn) {
    return (
      <div className="container" style={{ maxWidth: 420, paddingTop: 60 }}>
        <h1 style={{ fontSize: 22 }}>Internal test page</h1>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>
          Not linked anywhere public. Sign in to hit every backend skill directly.
        </p>

        {!codeSent ? (
          <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid var(--line)" }}
            />
            <button className="btn-primary" onClick={requestCode}>Send code</button>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
            <input
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid var(--line)" }}
            />
            <button className="btn-primary" onClick={verifyCode}>Verify & sign in</button>
          </div>
        )}
        {authError && <p style={{ color: "#a33", marginTop: 12, fontSize: 14 }}>{authError}</p>}
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 720, paddingTop: 40, paddingBottom: 60 }}>
      <h1 style={{ fontSize: 22 }}>Internal test page</h1>
      <p style={{ color: "var(--muted)", fontSize: 14 }}>
        Signed in as {email}. This hits the real backend, same as OKX would via /mcp.
      </p>

      <div className="card" style={{ marginTop: 20 }}>
        <strong style={{ fontSize: 14 }}>1. Add a note (entries feed every skill except Debrief)</strong>
        <textarea
          rows={3}
          value={entryText}
          onChange={(e) => setEntryText(e.target.value)}
          placeholder="e.g. 28 weeks, mild headaches the last 3 days, worse in the afternoon"
          style={{ width: "100%", marginTop: 10, padding: 10, borderRadius: 10, border: "1px solid var(--line)" }}
        />
        <button className="btn-secondary" style={{ marginTop: 10 }} onClick={addEntry}>Add entry</button>
        {entryStatus && <span style={{ marginLeft: 10, fontSize: 13, color: "var(--muted)" }}>{entryStatus}</span>}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <strong style={{ fontSize: 14 }}>Letter inputs (only used by the Letter skill)</strong>
        <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          <input
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="purpose"
            style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid var(--line)" }}
          />
          <input
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder="tone"
            style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid var(--line)" }}
          />
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <strong style={{ fontSize: 14 }}>Debrief input (only used by the Debrief skill, ignores saved entries)</strong>
        <textarea
          rows={3}
          value={visitNotes}
          onChange={(e) => setVisitNotes(e.target.value)}
          placeholder="Fresh notes from an appointment you just left..."
          style={{ width: "100%", marginTop: 10, padding: 10, borderRadius: 10, border: "1px solid var(--line)" }}
        />
      </div>

      <div style={{ marginTop: 24, display: "grid", gap: 16 }}>
        {SKILLS.map((skill) => (
          <div key={skill.key} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong>{skill.label}</strong>
                {skill.notInDemo && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--rosedeep)",
                      background: "var(--blush)",
                      padding: "2px 8px",
                      borderRadius: 999,
                    }}
                  >
                    Full version — same as OKX A2MCP
                  </span>
                )}
              </div>
              <button
                className="btn-primary"
                disabled={loadingKey === skill.key}
                onClick={() => runSkill(skill)}
              >
                {loadingKey === skill.key ? "Running..." : "Run"}
              </button>
            </div>
            {skill.pitch && (
              <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>{skill.pitch}</p>
            )}

            {errors[skill.key] && (
              <p style={{ color: "#a33", fontSize: 13, marginTop: 10 }}>{errors[skill.key]}</p>
            )}

            {results[skill.key] && (
              <div style={{ marginTop: 12 }}>
                <pre
                  style={{
                    whiteSpace: "pre-wrap",
                    fontSize: 13,
                    background: "var(--mist)",
                    padding: 12,
                    borderRadius: 10,
                    border: "1px solid var(--line)",
                  }}
                >
                  {JSON.stringify(results[skill.key].content, null, 2)}
                </pre>
                {results[skill.key].download?.url ? (
                  <a href={results[skill.key].download.url} target="_blank" rel="noreferrer">
                    <button className="btn-secondary" style={{ marginTop: 8 }}>Download PDF</button>
                  </a>
                ) : (
                  results[skill.key].download?.note && (
                    <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
                      {results[skill.key].download.note}
                    </p>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
