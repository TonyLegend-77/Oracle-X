const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export type MarketTick = {
  symbol: string;
  asset_type: string;
  sector: string | null;
  price: number;
  change_pct: number;
};

export type Regime = {
  regime: "RISK_ON" | "RISK_OFF" | "NEUTRAL";
  score: number;
  btc_trend?: number;
  qqq_trend?: number;
};

export type Signal = {
  id: number;
  asset: string;
  direction: "LONG" | "SHORT";
  alpha_score: number;
  confidence: number;
  expected_move_pct: number | null;
  current_move_pct: number | null;
  displacement_pct: number | null;
  risk_status: "PASS" | "BLOCK" | "PENDING";
  risk_reason: string | null;
  narrative: string | null;
  reason: Record<string, any> | null;
  status: string;
  timestamp: string;
  execution_url: string | null;
};

export type MarketMapData = {
  nodes: { id: number; symbol: string; sector: string | null; change_pct: number }[];
  edges: { source: number; target: number; correlation: number; lead_lag_hours: number }[];
};

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

export type SimulationResult = {
  entry: number;
  stop: number;
  target: number;
  risk_amount: number;
  reward_amount: number;
  risk_reward: number;
};

export const api = {
  liveMarket: () => get<MarketTick[]>("/market/live"),
  regime: () => get<Regime>("/market/regime"),
  marketMap: () => get<MarketMapData>("/market/map"),
  signals: (status?: string) => get<Signal[]>(`/signals${status ? `?status=${status}` : ""}`),
  signal: (id: number) => get<Signal>(`/signals/${id}`),
  why: (id: number) => get<{ explanation: string }>(`/signals/${id}/why`),
  simulate: (id: number) => post<SimulationResult>(`/signals/${id}/simulate`),
  logDelivery: (id: number, eventType: "delivered" | "execution_clicked") =>
    post<{ logged: boolean }>(`/signals/${id}/deliver`, { event_type: eventType }),
  closeOutcome: (
    id: number,
    body: { actual_return_pct: number; result_summary?: string; correct_factors?: string[]; missed_factors?: string[] }
  ) => post<{ prediction_error_pct: number }>(`/outcomes/${id}/close`, body),
};
