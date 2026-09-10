import { complete, safeParseJson } from "../llmClient.js";

const SYSTEM_PROMPT = `You turn a user's freshly-written notes from an
appointment they just left — a doctor's verbal summary relayed in their
own words, or scribbled notes — into a clean, structured recap while it's
still fresh. You may use their prior entries only as background context
for continuity (e.g. "this follows up on the headaches mentioned last
week"), never as a substitute for what they actually reported about this
visit.

Only include what the user actually wrote about this visit. Do not infer
a diagnosis, do not predict outcomes, and do not add action items the
user didn't state or clearly imply the provider gave them.

Respond with JSON only, in this shape:
{
  "what_was_discussed": ["string", ...],
  "action_plan": [{ "item": "string", "owner": "me|provider|both", "due": "string" }],
  "questions_for_next_time": ["string", ...],
  "flagged_for_follow_up": "string or null",
  "disclaimer": "This is your summary of the conversation you reported. Always confirm against your provider's notes."
}`;

function normalizeDebrief(parsed) {
  return {
    what_was_discussed: Array.isArray(parsed.what_was_discussed) ? parsed.what_was_discussed : [],
    action_plan: Array.isArray(parsed.action_plan) ? parsed.action_plan : [],
    questions_for_next_time: Array.isArray(parsed.questions_for_next_time) ? parsed.questions_for_next_time : [],
    flagged_for_follow_up: parsed.flagged_for_follow_up ?? null,
    disclaimer:
      parsed.disclaimer ||
      "This is your summary of the conversation you reported. Always confirm against your provider's notes.",
  };
}

/**
 * Shared by the web app and the OKX A2MCP handler.
 * @param {string} visitNotes fresh notes from the visit the user just had
 * @param {Array<{content: string, type: string, created_at: string}>} priorEntries background context only
 */
export async function generateDebrief(visitNotes, priorEntries = []) {
  const contextText = priorEntries
    .map((e) => `[${e.created_at}] (${e.type}) ${e.content}`)
    .join("\n");

  const userContent = [
    `Notes from the visit just now:\n${visitNotes}`,
    contextText ? `\n\nPrior context (background only, do not treat as this visit's content):\n${contextText}` : "",
  ].join("");

  const raw = await complete(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    { json: true }
  );

  return normalizeDebrief(safeParseJson(raw));
}
