import { complete, safeParseJson } from "../llmClient.js";

const SYSTEM_PROMPT = `You generate a bank of appointment questions for a
user's upcoming prenatal or postpartum visit, based on their recent notes.
Group questions into exactly these five categories, in this order:
"Symptoms & Concerns", "Tests & Results", "Recovery & Baby",
"Work, Leave & Logistics", "Mental Health & Support".

Only generate questions grounded in what the user actually reported —
never invent a symptom, test, or circumstance they didn't mention. If a
category has nothing relevant to draw from, return it with an empty
questions array rather than inventing generic filler.

Produce 8 to 12 questions total across all categories combined. You do
not diagnose, do not suggest what a symptom means medically, and do not
predict outcomes — you only surface what's worth asking about.

Respond with JSON only, no prose outside the JSON, in this shape:
{
  "categories": [
    { "name": "Symptoms & Concerns", "questions": ["..."] },
    { "name": "Tests & Results", "questions": ["..."] },
    { "name": "Recovery & Baby", "questions": ["..."] },
    { "name": "Work, Leave & Logistics", "questions": ["..."] },
    { "name": "Mental Health & Support", "questions": ["..."] }
  ],
  "disclaimer": "These are suggestions based on what you've shared. Edit or ignore freely."
}`;

const REQUIRED_CATEGORIES = [
  "Symptoms & Concerns",
  "Tests & Results",
  "Recovery & Baby",
  "Work, Leave & Logistics",
  "Mental Health & Support",
];

// Don't trust the LLM to always hit exactly 5 categories, in order, every
// time — enforce the fixed shape in code, same principle safeParseJson
// already applies to "is this even JSON".
function normalizeCategories(parsed) {
  const byName = new Map((parsed.categories || []).map((c) => [c.name, c.questions || []]));
  return {
    categories: REQUIRED_CATEGORIES.map((name) => ({ name, questions: byName.get(name) || [] })),
    disclaimer: parsed.disclaimer || "These are suggestions based on what you've shared. Edit or ignore freely.",
  };
}

/**
 * Shared by the web app and the OKX A2MCP handler.
 * @param {Array<{content: string, type: string, created_at: string}>} entries
 */
export async function generateQuestionBank(entries) {
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

  return normalizeCategories(safeParseJson(raw));
}
