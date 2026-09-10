import { Router } from "express";
import crypto from "crypto";
import { generateReport } from "../services/reportService.js";
import { draftLetter } from "../services/letterService.js";
import { generatePrepSheet } from "../services/prepService.js";
import { generateActionItems } from "../services/actionItemsService.js";
import { generateQuestionBank } from "../services/questionBankService.js";
import { generateDebrief } from "../services/debriefService.js";
import {
  reportToPdf,
  letterToPdf,
  prepSheetToPdf,
  actionItemsToPdf,
  questionBankToPdf,
  debriefToPdf,
  fullPackageToPdf,
} from "../services/pdfService.js";
import { uploadAndGetLink, isStorageConfigured } from "../storageClient.js";
import { isPaymentConfigured, PRICES } from "../x402.js";

const router = Router();

// This is the A2MCP surface for OKX AI Marketplace. Each skill is its own
// priced HTTP route (POST /mcp/<skill>) rather than a single dispatch
// endpoint, because OKX's x402 middleware prices routes by exact
// method+path — see src/x402.js, which is mounted in front of this router
// in server.js and gates every route below except GET /tools.
//
// Every route here just calls the same src/services/* functions the web
// dashboard's /generate/* routes use. One implementation, two callers.

const TOOLS = [
  {
    name: "generate_report",
    description: "Turn a list of health notes/entries into a structured plain-language report with insights and a provider-flag.",
    invoke: { method: "POST", path: "/mcp/report", price: PRICES.report },
    inputSchema: {
      type: "object",
      properties: {
        entries: { type: "array", items: { type: "object" } },
        include_pdf: { type: "boolean", default: true },
      },
      required: ["entries"],
    },
  },
  {
    name: "generate_prep_sheet",
    description: "Build an appointment prep sheet (key points, suggested questions, red flags) from a list of health notes/entries.",
    invoke: { method: "POST", path: "/mcp/prep", price: PRICES.prep },
    inputSchema: {
      type: "object",
      properties: {
        entries: { type: "array", items: { type: "object" } },
        include_pdf: { type: "boolean", default: true },
      },
      required: ["entries"],
    },
  },
  {
    name: "draft_letter",
    description: "Draft an advocacy letter (leave request, accommodation, insurance appeal) from a purpose, tone, and list of health notes/entries.",
    invoke: { method: "POST", path: "/mcp/letter", price: PRICES.letter },
    inputSchema: {
      type: "object",
      properties: {
        purpose: { type: "string", description: "e.g. 'employer accommodation request'" },
        tone: { type: "string", description: "e.g. 'firm', 'warm', 'formal'" },
        entries: { type: "array", items: { type: "object" } },
        include_pdf: { type: "boolean", default: true },
      },
      required: ["purpose", "tone", "entries"],
    },
  },
  {
    name: "generate_action_items",
    description: "Extract prioritized action items (immediate, this week, discuss at next appointment, long-term) from a list of health notes/entries.",
    invoke: { method: "POST", path: "/mcp/action-items", price: PRICES["action-items"] },
    inputSchema: {
      type: "object",
      properties: {
        entries: { type: "array", items: { type: "object" } },
        include_pdf: { type: "boolean", default: true },
      },
      required: ["entries"],
    },
  },
  {
    name: "generate_question_bank",
    description: "Generate a categorized bank of 8-12 appointment questions (symptoms, tests, recovery, work/logistics, mental health) from a list of health notes/entries.",
    invoke: { method: "POST", path: "/mcp/questions", price: PRICES.questions },
    inputSchema: {
      type: "object",
      properties: {
        entries: { type: "array", items: { type: "object" } },
        include_pdf: { type: "boolean", default: true },
      },
      required: ["entries"],
    },
  },
  {
    name: "generate_debrief",
    description: "Turn fresh notes from an appointment the user just left into a structured recap. Prior entries are used only as background context, not as the visit content itself.",
    invoke: { method: "POST", path: "/mcp/debrief", price: PRICES.debrief },
    inputSchema: {
      type: "object",
      properties: {
        visitNotes: { type: "string", description: "Fresh notes/transcript from the visit just had" },
        entries: { type: "array", items: { type: "object" }, description: "Optional, background context only" },
        include_pdf: { type: "boolean", default: true },
      },
      required: ["visitNotes"],
    },
  },
  {
    name: "generate_full_package",
    description: "Runs all 6 skills at once against the same input and returns one combined document. $2 flat — cheaper than buying all 6 individually at $0.50 each.",
    invoke: { method: "POST", path: "/mcp/full-package", price: PRICES["full-package"] },
    inputSchema: {
      type: "object",
      properties: {
        entries: { type: "array", items: { type: "object" } },
        purpose: { type: "string", description: "for the letter section" },
        tone: { type: "string", description: "for the letter section" },
        visitNotes: { type: "string", description: "for the debrief section; omit to skip it" },
        include_pdf: { type: "boolean", default: true },
      },
      required: ["entries"],
    },
  },
];

router.get("/tools", (req, res) => {
  res.json({
    tools: TOOLS,
    payment: isPaymentConfigured()
      ? { scheme: "x402", network: "eip155:196" }
      : { scheme: "none", note: "Payment not configured on this deployment — routes are currently unmetered." },
  });
});

function normalizeEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("entries must be a non-empty array");
  }
  return entries.map((e) => ({
    content: String(e.content ?? ""),
    type: e.type ?? "text",
    created_at: e.created_at ?? new Date().toISOString(),
  }));
}

// A URL is far more useful to a calling agent than raw JSON it has to
// render itself. `include_pdf: false` skips this entirely — some callers
// only want structured JSON and shouldn't pay the latency/storage cost of
// a PDF they'll never open.
async function tryBuildDownload(includePdf, pdfBuilder, content, key) {
  if (includePdf === false) {
    return { url: null, expires_at: null, note: "PDF not requested (include_pdf: false)." };
  }
  if (!isStorageConfigured()) {
    return { url: null, expires_at: null, note: "Downloadable link not configured on this deployment." };
  }
  try {
    const buffer = await pdfBuilder(content);
    const { url, expiresAt } = await uploadAndGetLink(buffer, key);
    return { url, expires_at: expiresAt, note: null };
  } catch (err) {
    console.error("MCP PDF upload failed:", err.message);
    return { url: null, expires_at: null, note: "Could not generate a download link right now." };
  }
}

function errorStatus(err) {
  return err.message?.startsWith("entries") || err.message?.includes("required") ? 400 : 502;
}

router.post("/report", async (req, res) => {
  try {
    const entries = normalizeEntries(req.body?.entries);
    const content = await generateReport(entries);
    const download = await tryBuildDownload(req.body?.include_pdf, reportToPdf, content, `mcp/reports/${crypto.randomUUID()}.pdf`);
    res.json({ content, download });
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

router.post("/prep", async (req, res) => {
  try {
    const entries = normalizeEntries(req.body?.entries);
    const content = await generatePrepSheet(entries);
    const download = await tryBuildDownload(req.body?.include_pdf, prepSheetToPdf, content, `mcp/prep/${crypto.randomUUID()}.pdf`);
    res.json({ content, download });
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

router.post("/letter", async (req, res) => {
  try {
    const entries = normalizeEntries(req.body?.entries);
    if (!req.body?.purpose || !req.body?.tone) throw new Error("purpose and tone are required");
    const content = await draftLetter(req.body.purpose, req.body.tone, entries);
    const download = await tryBuildDownload(req.body?.include_pdf, letterToPdf, content, `mcp/letters/${crypto.randomUUID()}.pdf`);
    res.json({ content, download });
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

router.post("/action-items", async (req, res) => {
  try {
    const entries = normalizeEntries(req.body?.entries);
    const content = await generateActionItems(entries);
    const download = await tryBuildDownload(req.body?.include_pdf, actionItemsToPdf, content, `mcp/action-items/${crypto.randomUUID()}.pdf`);
    res.json({ content, download });
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

router.post("/questions", async (req, res) => {
  try {
    const entries = normalizeEntries(req.body?.entries);
    const content = await generateQuestionBank(entries);
    const download = await tryBuildDownload(req.body?.include_pdf, questionBankToPdf, content, `mcp/questions/${crypto.randomUUID()}.pdf`);
    res.json({ content, download });
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

router.post("/debrief", async (req, res) => {
  try {
    if (!req.body?.visitNotes || !String(req.body.visitNotes).trim()) {
      throw new Error("visitNotes is required");
    }
    const priorEntries = Array.isArray(req.body?.entries) && req.body.entries.length ? normalizeEntries(req.body.entries) : [];
    const content = await generateDebrief(String(req.body.visitNotes), priorEntries);
    const download = await tryBuildDownload(req.body?.include_pdf, debriefToPdf, content, `mcp/debriefs/${crypto.randomUUID()}.pdf`);
    res.json({ content, download });
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

// The $2 bundle. Runs all 6 skills against the same input; a single
// sub-generation failing degrades the response instead of failing the
// whole paid call — the caller already paid, a partial deliverable beats
// nothing. `succeeded` / `failed` make that explicit rather than silent.
router.post("/full-package", async (req, res) => {
  const entries = (() => {
    try {
      return normalizeEntries(req.body?.entries);
    } catch (err) {
      return null;
    }
  })();
  if (!entries) {
    return res.status(400).json({ error: "entries must be a non-empty array" });
  }

  const purpose = req.body?.purpose || "general advocacy letter";
  const tone = req.body?.tone || "warm but firm";
  const visitNotes = req.body?.visitNotes ? String(req.body.visitNotes) : null;

  const jobs = {
    report: () => generateReport(entries),
    prep: () => generatePrepSheet(entries),
    letter: () => draftLetter(purpose, tone, entries),
    actionItems: () => generateActionItems(entries),
    questionBank: () => generateQuestionBank(entries),
    ...(visitNotes ? { debrief: () => generateDebrief(visitNotes, entries) } : {}),
  };

  const results = {};
  const succeeded = [];
  const failed = [];

  for (const [key, run] of Object.entries(jobs)) {
    try {
      results[key] = await run();
      succeeded.push(key);
    } catch (err) {
      failed.push({ section: key, error: err.message });
    }
  }

  const download = await tryBuildDownload(
    req.body?.include_pdf,
    fullPackageToPdf,
    results,
    `mcp/full-package/${crypto.randomUUID()}.pdf`
  );

  res.json({ content: results, succeeded, failed, download });
});

export default router;
