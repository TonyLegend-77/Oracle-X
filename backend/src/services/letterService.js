import { complete, safeParseJson } from "../llmClient.js";

const SYSTEM_PROMPT = `You draft advocacy letters (employer accommodation
requests, insurance appeals, provider correspondence) for a user based on
their reported history. You write in a professional, evidence-based tone.
You never state medical facts the user didn't report, and you never claim
legal authority. Every letter you produce is a draft the user must review
before sending.

Respond with JSON only, in this shape:
{
  "subject": "string",
  "body": "string, full letter text",
  "tone_notes": "one sentence describing the tone you used",
  "disclaimer": "Draft only. Review before sending. Not legal advice."
}`;

/**
 * @param {string} purpose e.g. "employer accommodation request"
 * @param {string} tone e.g. "firm", "warm", "formal"
 * @param {Array<{content: string, type: string, created_at: string}>} entries
 */
export async function draftLetter(purpose, tone, entries) {
  const historyText = entries
    .map((e) => `[${e.created_at}] (${e.type}) ${e.content}`)
    .join("\n");

  const userPrompt = `Purpose: ${purpose}\nRequested tone: ${
    tone || "professional"
  }\n\nRelevant history:\n${historyText || "None provided."}`;

  const raw = await complete(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    { json: true }
  );

  return safeParseJson(raw);
}
