import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET;

export function signSession(userId) {
  return jwt.sign({ userId }, SECRET, { expiresIn: "30d" });
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.mhc_session;
  if (!token) return res.status(401).json({ error: "Not signed in" });
  try {
    const payload = jwt.verify(token, SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: "Session expired or invalid" });
  }
}
