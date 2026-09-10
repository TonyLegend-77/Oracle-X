import { Router } from "express";
import { query } from "../db.js";

const router = Router();

// Fallback window only — if Polymarket is down, serve the most recent
// snapshot rather than a hard error, but always try live first. Real-time
// is the point of this endpoint.
const FALLBACK_MAX_AGE_MINUTES = 120;

// Read-only, no auth, no consent flow. Informational only, clearly labeled.
// Always hits Polymarket's public gamma API live; predictions_cache is
// write-through history for /stats and a fallback if the live call fails,
// never a read-first cache.
router.get("/info", async (req, res) => {
  const topic = (req.query.topic || "maternity leave").toString();

  try {
    const url = `https://gamma-api.polymarket.com/markets?closed=false&search=${encodeURIComponent(
      topic
    )}&limit=5`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Polymarket API returned ${resp.status}`);
    const markets = await resp.json();

    await query(
      `INSERT INTO predictions_cache (topic, data_json, fetched_at)
       VALUES ($1, $2, NOW())`,
      [topic, JSON.stringify(markets)]
    );

    res.json({
      topic,
      source: "live",
      fetched_at: new Date().toISOString(),
      markets,
      disclaimer: "Informational only. Not financial advice.",
    });
  } catch (err) {
    const fallback = await query(
      `SELECT data_json, fetched_at FROM predictions_cache
       WHERE topic = $1 AND fetched_at > NOW() - INTERVAL '${FALLBACK_MAX_AGE_MINUTES} minutes'
       ORDER BY fetched_at DESC LIMIT 1`,
      [topic]
    );

    if (fallback.rows.length) {
      return res.json({
        topic,
        source: "stale_fallback",
        fetched_at: fallback.rows[0].fetched_at,
        markets: fallback.rows[0].data_json,
        disclaimer: "Informational only. Not financial advice. Live fetch failed; showing last known data.",
      });
    }

    res.status(502).json({ error: err.message });
  }
});

export default router;
