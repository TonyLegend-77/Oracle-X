import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import usersRoutes from "./routes/users.js";
import ingestRoutes from "./routes/ingest.js";
import generateRoutes from "./routes/generate.js";
import predictionsRoutes from "./routes/predictions.js";
import anchorRoutes from "./routes/anchor.js";
import demoRoutes from "./routes/demo.js";
import statsRoutes from "./routes/stats.js";
import mcpRoutes from "./routes/mcp.js";
import { buildPaymentMiddleware } from "./x402.js";

const app = express();

const rawOrigins = (process.env.CORS_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);

if (rawOrigins.length === 0) {
  if (process.env.NODE_ENV === "production") {
    // Fail loudly at boot instead of silently blocking every request.
    // A missing CORS_ORIGIN used to produce allowedOrigins = [""], which
    // rejects every browser request with no clue why in the response.
    console.error("CORS_ORIGIN is not set. Refusing to start in production without it.");
    process.exit(1);
  }
  console.warn("CORS_ORIGIN is not set, defaulting to http://localhost:3001 for local dev.");
  rawOrigins.push("http://localhost:3001");
}

// Fail fast on anything required for the app to actually work, the same
// way the CORS_ORIGIN check above does. Better a crash-on-boot with a
// clear message in Railway logs than a 500 on a real user's first request.
const REQUIRED_IN_PRODUCTION = ["JWT_SECRET", "DATABASE_URL", "LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL"];
if (process.env.NODE_ENV === "production") {
  const missing = REQUIRED_IN_PRODUCTION.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(`Missing required env var(s): ${missing.join(", ")}. Refusing to start in production.`);
    process.exit(1);
  }
}

app.use(cors({ origin: rawOrigins, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/users", usersRoutes);
app.use("/ingest", ingestRoutes);
app.use("/generate", generateRoutes);
app.use("/predictions", predictionsRoutes);
app.use("/anchor", anchorRoutes);
app.use("/demo", demoRoutes);
app.use("/stats", statsRoutes);

// x402 payment gate sits in front of /mcp. It only intercepts the 7
// specific POST routes it's configured for (src/x402.js) — GET /mcp/tools
// stays free for discovery. If OKX payment credentials aren't set, this
// is null and every /mcp/* route runs unmetered: fine for local dev,
// never acceptable for a real OKX-facing deployment. isPaymentConfigured()
// is also reported in GET /mcp/tools so an unmetered deployment is
// self-documenting to anyone/anything calling it, including OKX's own
// review process.
const paymentGate = await buildPaymentMiddleware();
if (paymentGate) {
  app.use(paymentGate);
} else if (process.env.NODE_ENV === "production") {
  console.warn(
    "x402 payment not configured (OKX_API_KEY / OKX_SECRET_KEY / OKX_PASSPHRASE / PAY_TO_ADDRESS). " +
      "/mcp/* routes are running UNMETERED in production. Set these before this ASP goes live on OKX."
  );
}
app.use("/mcp", mcpRoutes);

// /mcp/tools (GET, free) lists all 7 skills including price + invoke path.
// The 6 single-skill routes and /mcp/full-package (the $2 bundle) are the
// paid A2MCP surface OKX AI Marketplace calls once the ASP is registered.
// Same services/* functions as /generate/*, just a different, paid,
// unauthenticated caller — see src/routes/mcp.js and src/x402.js.

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MHC backend listening on ${PORT}`));
