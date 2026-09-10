import { Router } from "express";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { query } from "../db.js";
import { generateReport } from "../services/reportService.js";
import { draftLetter } from "../services/letterService.js";

const router = Router();

// Unauthenticated, rate-limited, never touches users/entries/reports tables.
const demoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demo limit reached. Sign up on OKX AI to continue." },
});

const DEMO_WORD_LIMIT = 50;

// The demo is a teaser, not the product. Full-length reports/letters are
// the paid A2MCP service on OKX AI. Truncating here (server-side, so it
// can't be bypassed from the client) keeps that boundary real.
function truncateToWords(value, limit) {
  if (typeof value === "string") {
    const words = value.trim().split(/\s+/);
    if (words.length <= limit) return value;
    return words.slice(0, limit).join(" ") + "…";
  }
  if (value && typeof value === "object") {
    const out = Array.isArray(value) ? [] : {};
    for (const key of Object.keys(value)) {
      out[key] = truncateToWords(value[key], limit);
    }
    return out;
  }
  return value;
}

router.post("/generate", demoLimiter, async (req, res) => {
  const { scenario, mode } = req.body; // mode: "report" | "letter"
  if (!scenario) return res.status(400).json({ error: "scenario is required" });

  let sessionId = req.cookies?.mhc_demo_session;
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    res.cookie("mhc_demo_session", sessionId, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: "lax",
    });
  }

  const syntheticEntry = [{ type: "text", content: scenario, created_at: new Date().toISOString() }];

  try {
    const fullContent =
      mode === "letter"
        ? await draftLetter("demo request", "professional", syntheticEntry)
        : await generateReport(syntheticEntry);

    const content = truncateToWords(fullContent, DEMO_WORD_LIMIT);

    await query(
      `INSERT INTO demo_sessions (session_id, scenario, mode, result_json)
       VALUES ($1, $2, $3, $4)`,
      [sessionId, scenario, mode || "report", JSON.stringify(content)]
    );

    res.json({
      content,
      demo: true,
      banner: `Demo preview, capped at ${DEMO_WORD_LIMIT} words per field. Full-length reports and letters run through the OKX AI Marketplace listing.`,
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

export default router;
