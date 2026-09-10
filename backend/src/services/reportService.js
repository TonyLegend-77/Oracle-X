import { complete, safeParseJson } from "../llmClient.js";

const SYSTEM_PROMPT = `You are a maternal health summary assistant. You turn a
user's raw notes (symptoms, visit notes, questions) into a clear, structured
summary. You are not a doctor and you never diagnose, prescribe, or tell the
user what a symptom means medically. You organize and clarify what the user
already reported, flag anything that sounds like it needs prompt medical
attention (e.g. severe pain, bleeding, vision changes) as a "check with your
provider soon" note, and never invent facts not present in the input.

Respond with JSON only, no prose outside the JSON, in this shape:
{
  "summary": "2-4 sentence plain-language summary",
  "insights": [{ "type": "trend" | "note", "text": "..." }],
  "flagged_for_provider": boolean,
  "flag_reason": "string or null"
}`;

/**
 * Shared by the web app and the OKX A2MCP handler. Same function, two callers.
 * @param {Array<{content: string, type: string, created_at: string}>} entries
 */
export async function generateReport(entries) {
  const historyText = entries
    .map((e) => `[${e.created_at}] (${e.type}) ${e.content}`)
    .join("\n");

  const raw = await complete(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: historyText || "No entries provided." },
    ],
    { json: true }
  );

  return safeParseJson(raw);
}
