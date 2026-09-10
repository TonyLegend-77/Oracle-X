import { Router } from "express";
import { query } from "../db.js";

const router = Router();

// Public, read-only, no auth. Powers the landing page's live stats strip.
// Counts only, never content, so this can never leak anything from a
// specific user's history.
router.get("/public", async (req, res) => {
  try {
    const [reports, letters, demoRuns] = await Promise.all([
      query("SELECT COUNT(*)::int AS n FROM reports"),
      query("SELECT COUNT(*)::int AS n FROM letters"),
      query("SELECT COUNT(*)::int AS n FROM demo_sessions"),
    ]);

    res.json({
      reports: reports.rows[0].n,
      letters: letters.rows[0].n,
      demoRuns: demoRuns.rows[0].n,
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

export default router;
