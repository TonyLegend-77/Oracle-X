import { Router } from "express";
import crypto from "crypto";
import { requireAuth } from "../auth.js";
import { query } from "../db.js";
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
} from "../services/pdfService.js";
import { uploadAndGetLink, isStorageConfigured } from "../storageClient.js";

const router = Router();

async function recentEntries(userId, limit = 20) {
  const result = await query(
    `SELECT id, type, content, created_at FROM entries
     WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

// Best-effort: a report/letter/prep sheet is still useful without a
// download link, so a storage outage or missing R2 config downgrades to
// `download: null` instead of failing the whole request.
async function tryBuildDownload(pdfBuilder, content, key) {
  if (!isStorageConfigured()) {
    return { url: null, expires_at: null, note: "Downloadable link not configured on this deployment." };
  }
  try {
    const buffer = await pdfBuilder(content);
    const { url, expiresAt } = await uploadAndGetLink(buffer, key);
    return { url, expires_at: expiresAt, note: null };
  } catch (err) {
    console.error("PDF upload failed:", err.message);
    return { url: null, expires_at: null, note: "Could not generate a download link right now." };
  }
}

router.post("/report", requireAuth, async (req, res) => {
  try {
    const entries = await recentEntries(req.userId);
    const content = await generateReport(entries);

    const saved = await query(
      `INSERT INTO reports (user_id, entry_ids, content_json)
       VALUES ($1, $2, $3) RETURNING id, created_at`,
      [req.userId, entries.map((e) => e.id), JSON.stringify(content)]
    );
    const { id, created_at } = saved.rows[0];

    const download = await tryBuildDownload(reportToPdf, content, `reports/${req.userId}/${id}.pdf`);

    res.json({ id, created_at, content, download });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post("/prep", requireAuth, async (req, res) => {
  try {
    const entries = await recentEntries(req.userId);
    const content = await generatePrepSheet(entries);

    // Prep sheets aren't persisted (generated fresh each time), but the
    // PDF still gets a stable-enough key for its 7-day link lifetime.
    const download = await tryBuildDownload(
      prepSheetToPdf,
      content,
      `prep/${req.userId}/${crypto.randomUUID()}.pdf`
    );

    res.json({ content, download });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post("/letter", requireAuth, async (req, res) => {
  const { purpose, tone } = req.body;
  if (!purpose) return res.status(400).json({ error: "purpose is required" });

  try {
    const entries = await recentEntries(req.userId);
    const content = await draftLetter(purpose, tone, entries);

    const saved = await query(
      `INSERT INTO letters (user_id, purpose, draft_content, approved)
       VALUES ($1, $2, $3, false) RETURNING id, created_at`,
      [req.userId, purpose, JSON.stringify(content)]
    );
    const { id, created_at } = saved.rows[0];

    const download = await tryBuildDownload(letterToPdf, content, `letters/${req.userId}/${id}.pdf`);

    res.json({ id, created_at, content, download });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post("/action-items", requireAuth, async (req, res) => {
  try {
    const entries = await recentEntries(req.userId);
    const content = await generateActionItems(entries);

    const download = await tryBuildDownload(
      actionItemsToPdf,
      content,
      `action-items/${req.userId}/${crypto.randomUUID()}.pdf`
    );

    res.json({ content, download });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post("/questions", requireAuth, async (req, res) => {
  try {
    const entries = await recentEntries(req.userId);
    const content = await generateQuestionBank(entries);

    const download = await tryBuildDownload(
      questionBankToPdf,
      content,
      `questions/${req.userId}/${crypto.randomUUID()}.pdf`
    );

    res.json({ content, download });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post("/debrief", requireAuth, async (req, res) => {
  const { visitNotes } = req.body;
  if (!visitNotes || !visitNotes.trim()) {
    return res.status(400).json({ error: "visitNotes is required" });
  }

  try {
    // Prior entries are background context only — the debrief prompt is
    // told explicitly not to treat them as this visit's content.
    const priorEntries = await recentEntries(req.userId, 10);
    const content = await generateDebrief(visitNotes, priorEntries);

    const download = await tryBuildDownload(
      debriefToPdf,
      content,
      `debriefs/${req.userId}/${crypto.randomUUID()}.pdf`
    );

    res.json({ content, download });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

export default router;
