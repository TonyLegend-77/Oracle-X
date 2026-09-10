// Single entry point for every LLM call in the app. Every service (report,
// letter, prep sheet) calls through here instead of hitting a provider API
// directly, so swapping providers or models is a config change, not a
// rewrite. Works with any OpenAI-compatible chat completions endpoint,
// which covers Qwen (DashScope) and DeepSeek out of the box.

const BASE_URL = process.env.LLM_BASE_URL;
const API_KEY = process.env.LLM_API_KEY;
const MODEL = process.env.LLM_MODEL;

/**
 * @param {Array<{role: string, content: string}>} messages
 * @param {{ json?: boolean, maxTokens?: number }} [options]
 * @returns {Promise<string>} raw text content of the model's reply
 */
export async function complete(messages, options = {}) {
  if (!BASE_URL || !API_KEY || !MODEL) {
    throw new Error(
      "LLM not configured. Set LLM_BASE_URL, LLM_API_KEY, LLM_MODEL."
    );
  }

  const body = {
    model: MODEL,
    messages,
    max_tokens: options.maxTokens ?? 1200,
  };

  if (options.json) {
    // Most OpenAI-compatible providers support this. If a provider you pick
    // doesn't, drop this field and rely on the prompt instructing JSON-only
    // output plus the safeParseJson helper below.
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM request failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

/** Strips markdown code fences and parses JSON, with a clear error on failure. */
export function safeParseJson(raw) {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Model did not return valid JSON: ${err.message}`);
  }
}
