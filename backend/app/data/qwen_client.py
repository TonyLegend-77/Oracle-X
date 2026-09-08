"""
Qwen client — used by Interpreter (structured event extraction) and
Narrator (human-readable causal-chain explanations). OpenAI-compatible
endpoint via DashScope; swap QWEN_BASE_URL if using Alibaba Cloud direct
or a hackathon-provided endpoint/subsidy key instead.
"""
import json
import requests
from app import config


class QwenClient:
    def __init__(self):
        self.base_url = config.QWEN_BASE_URL
        self.api_key = config.QWEN_API_KEY
        self.model = config.QWEN_MODEL

    def _chat(self, system: str, user: str, temperature: float = 0.2, json_mode: bool = False) -> str:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": temperature,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        resp = requests.post(
            f"{self.base_url}/chat/completions", headers=headers, json=payload, timeout=30
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]

    def extract_event(self, raw_headline: str, raw_source: str = "") -> dict:
        """Interpreter agent: raw text -> structured event JSON (spec section 12, Agent 2)."""
        system = (
            "You are a financial event extraction engine. Given a raw news "
            "headline/body, output ONLY a JSON object with keys: "
            "asset (ticker), event_type (earnings|product|macro|crypto_news|sec_filing), "
            "sentiment (bullish|bearish|neutral), magnitude (0.0-1.0), "
            "horizon_hours (int), affected_assets (list of tickers plausibly "
            "impacted downstream). No prose, no markdown, JSON only."
        )
        user = f"HEADLINE: {raw_headline}\nSOURCE: {raw_source}"
        raw = self._chat(system, user, json_mode=True)
        return json.loads(raw)

    def explain_causal_chain(self, signal_context: dict) -> str:
        """Narrator agent: structured signal + factor data -> human-readable explanation."""
        system = (
            "You are Oracle X's Narrator. Given structured signal data "
            "(triggering event, correlation chain, displacement, historical "
            "analogues, alpha score), write a concise, confident causal-chain "
            "explanation a trader would read in under 15 seconds. No hedging "
            "filler, no disclaimers, just the reasoning chain and the evidence."
        )
        user = json.dumps(signal_context)
        return self._chat(system, user, temperature=0.4)

    def explain_what_changed(self, before: dict, after: dict) -> str:
        """WHY? / 'What Changed?' button (spec section 9)."""
        system = (
            "You are Oracle X. Given 'before event' and 'after event' market "
            "state (correlation, displacement, volume, sentiment, regime), "
            "explain in 2-3 sentences what structurally changed and why it "
            "matters for this signal."
        )
        user = json.dumps({"before": before, "after": after})
        return self._chat(system, user, temperature=0.3)
