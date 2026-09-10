import { Router } from "express";
import { requireAuth } from "../auth.js";

const router = Router();

// Placeholder until the OnchainOS skill + shared Agentic Wallet are set up
// (one-time local step: `npx skills add okx/onchainos-skills`). Wire this to
// the actual wallet call once that setup is done. Kept as its own route so
// the rest of the app never has to know whether anchoring is live yet.
router.post("/", requireAuth, async (req, res) => {
  const { report_id } = req.body;
  if (!report_id) return res.status(400).json({ error: "report_id is required" });

  res.status(501).json({
    error: "On-chain anchoring not yet wired up.",
    todo: "Call OnchainOS with the shared Agentic Wallet once npx skills add okx/onchainos-skills has been run locally.",
  });
});

export default router;
