import { Router } from "express";
import { requireAuth } from "../auth.js";
import { query } from "../db.js";

const router = Router();

router.post("/", requireAuth, async (req, res) => {
  const { type, content, source_metadata } = req.body;
  if (!type || !content) {
    return res.status(400).json({ error: "type and content are required" });
  }
  if (!["text", "file"].includes(type)) {
    return res.status(400).json({ error: "type must be text or file" });
  }

  const result = await query(
    `INSERT INTO entries (user_id, type, content, source_metadata)
     VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
    [req.userId, type, content, source_metadata ? JSON.stringify(source_metadata) : null]
  );

  res.json({ id: result.rows[0].id, created_at: result.rows[0].created_at });
});

// Recent entries for the signed-in user, used to build context for generation.
router.get("/", requireAuth, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const result = await query(
    `SELECT id, type, content, created_at FROM entries
     WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [req.userId, limit]
  );
  res.json({ entries: result.rows });
});

export default router;
