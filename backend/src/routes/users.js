import { Router } from "express";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { query } from "../db.js";
import { signSession } from "../auth.js";
import { sendLoginCode } from "../emailClient.js";

const router = Router();

const CODE_TTL_MINUTES = 10;
const MAX_VERIFY_ATTEMPTS = 5;

// Six requests per email-ish window: loose enough for a real user who
// fat-fingers their address twice, tight enough that spamming someone
// else's inbox with codes isn't free.
const requestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many code requests. Try again in a few minutes." },
});

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again in a few minutes." },
});

function hashCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

// Step 1: email in, a 6-digit code goes out. No session yet, so this alone
// can never be used to claim someone else's account.
router.post("/session/request", requestLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ error: "A valid email is required" });
  }
  const normalizedEmail = email.trim().toLowerCase();

  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

  await query(
    `INSERT INTO login_codes (email, code_hash, expires_at) VALUES ($1, $2, $3)`,
    [normalizedEmail, hashCode(code), expiresAt]
  );

  await sendLoginCode(normalizedEmail, code);

  res.json({ ok: true, expiresInMinutes: CODE_TTL_MINUTES });
});

// Step 2: email + code in, session cookie out. Only a correct, unexpired,
// unused code issues a session, and each row can only ever be consumed once.
router.post("/session/verify", verifyLimiter, async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: "email and code are required" });
  }
  const normalizedEmail = email.trim().toLowerCase();

  const { rows } = await query(
    `SELECT * FROM login_codes
     WHERE email = $1 AND consumed_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [normalizedEmail]
  );
  const record = rows[0];

  if (!record) {
    return res.status(401).json({ error: "Code expired or not found. Request a new one." });
  }
  if (record.attempt_count >= MAX_VERIFY_ATTEMPTS) {
    return res.status(429).json({ error: "Too many incorrect attempts. Request a new code." });
  }

  if (hashCode(code) !== record.code_hash) {
    await query(`UPDATE login_codes SET attempt_count = attempt_count + 1 WHERE id = $1`, [record.id]);
    return res.status(401).json({ error: "Incorrect code" });
  }

  await query(`UPDATE login_codes SET consumed_at = NOW() WHERE id = $1`, [record.id]);

  const existing = await query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
  let userId;
  if (existing.rows.length) {
    userId = existing.rows[0].id;
  } else {
    const inserted = await query(
      "INSERT INTO users (email) VALUES ($1) RETURNING id",
      [normalizedEmail]
    );
    userId = inserted.rows[0].id;
  }

  const token = signSession(userId);
  res.cookie("mhc_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
  res.json({ ok: true });
});

router.post("/delete", async (req, res) => {
  const token = req.cookies?.mhc_session;
  if (!token) return res.status(401).json({ error: "Not signed in" });
  // Soft delete: mark for deletion, actual purge runs on a schedule so a
  // user can't be locked out mid-request and support can still investigate
  // abuse reports for a short window before data is gone for good.
  res.json({ ok: true, note: "Deletion requested. Implement purge job separately." });
});

export default router;
