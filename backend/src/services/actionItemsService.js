import { complete, safeParseJson } from "../llmClient.js";

const SYSTEM_PROMPT = `You extract action items from a user's recent
prenatal or postpartum notes. Look for anything implied or explicit —
"I need to...", "should ask about...", "have to schedule..." — and sort
each into exactly one of four buckets by urgency: immediate, this_week,
discuss_at_next_appointment, long_term_or_optional.

Only extract items grounded in what the user actually wrote. Do not
invent tasks they didn't imply. If a bucket has nothing in it, return an
empty array for it rather than inventing filler. You do not diagnose and
do not predict outcomes — you only extract and organize what they already
said they need to do.

Respond with JSON only, in this shape:
{
  "immediate": ["string", ...],
  "this_week": ["string", ...],
  "discuss_at_next_appointment": ["string", ...],
  "long_term_or_optional": ["string", ...],
  "disclaimer": "This is an extraction from your own notes. Review and adjust."
}`;

const REQUIRED_BUCKETS = ["immediate", "this_week", "discuss_at_next_appointment", "long_term_or_optional"];

// Same defensive-normalize pattern as questionBankService: a fixed-shape
// prompt is a request, not a guarantee, so enforce the keys in code.
function normalizeBuckets(parsed) {
  const out = {};
  for (const key of REQUIRED_BUCKETS) {
    out[key] = Array.isArray(parsed[key]) ? parsed[key] : [];
  }
  out.disclaimer = parsed.disclaimer || "This is an extraction from your own notes. Review and adjust.";
  return out;
}

/**
 * Shared by the web app and the OKX A2MCP handler.
 * @param {Array<{content: string, type: string, created_at: string}>} entries
 */
export async function generateActionItems(entries) {
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

  return normalizeBuckets(safeParseJson(raw));
}
