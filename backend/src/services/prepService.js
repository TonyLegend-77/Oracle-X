import { complete, safeParseJson } from "../llmClient.js";

const SYSTEM_PROMPT = `You prepare a short briefing for a user's upcoming
prenatal or postpartum appointment, based on their recent notes. You surface
what's worth mentioning and suggest questions to ask. You do not diagnose or
predict outcomes.

Respond with JSON only, in this shape:
{
  "key_points_to_mention": ["string", ...],
  "suggested_questions": ["string", ...],
  "red_flags_to_raise": ["string", ...]
}`;

/**
 * @param {Array<{content: string, type: string, created_at: string}>} entries
 */
export async function generatePrepSheet(entries) {
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
