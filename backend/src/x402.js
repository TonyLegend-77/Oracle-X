// Real x402 integration, via OKX's own Node SDK — not a hand-rolled 402
// implementation. The SDK intercepts unpaid requests and returns HTTP 402
// before any business logic runs; only a signature-verified payment ever
// reaches the route handlers in mcp.js. See:
// https://web3.okx.com/onchainos/dev-docs/payments/service-seller-sdk

const NETWORK = "eip155:196"; // X Layer

const REQUIRED = ["OKX_API_KEY", "OKX_SECRET_KEY", "OKX_PASSPHRASE", "PAY_TO_ADDRESS"];

export function isPaymentConfigured() {
  return REQUIRED.every((key) => !!process.env[key]);
}

// Single-skill tools: $0.50 each. Bundle: $2.00 flat (a discount vs. buying
// all 6 individually at $0.50 — that gap is the whole incentive to choose
// the bundle, don't let it drift).
export const PRICES = {
  report: "$0.50",
  prep: "$0.50",
  letter: "$0.50",
  "action-items": "$0.50",
  questions: "$0.50",
  debrief: "$0.50",
  "full-package": "$2.00",
};

/**
 * Builds the paymentMiddleware instance for the 7 priced /mcp/* routes.
 * Returns null if OKX payment credentials aren't set — caller is
 * responsible for skipping payment gating in that case (dev/local only,
 * never in a real OKX-facing deployment).
 */
export async function buildPaymentMiddleware() {
  if (!isPaymentConfigured()) return null;

  // Dynamic import so a missing/unconfigured deployment never pays the
  // cost of loading the SDK at all, and so this file has zero effect on
  // boot time when payments aren't in play yet (e.g. local dev).
  const { paymentMiddleware, x402ResourceServer } = await import("@okxweb3/x402-express");
  const { ExactEvmScheme } = await import("@okxweb3/x402-evm/exact/server");
  const { OKXFacilitatorClient } = await import("@okxweb3/x402-core");

  const facilitatorClient = new OKXFacilitatorClient({
    apiKey: process.env.OKX_API_KEY,
    secretKey: process.env.OKX_SECRET_KEY,
    passphrase: process.env.OKX_PASSPHRASE,
  });

  const resourceServer = new x402ResourceServer(facilitatorClient);
  resourceServer.register(NETWORK, new ExactEvmScheme());

  const payTo = process.env.PAY_TO_ADDRESS;

  const routeConfig = (path, price, description) => ({
    [`POST /mcp/${path}`]: {
      accepts: [{ scheme: "exact", network: NETWORK, payTo, price }],
      description,
      mimeType: "application/json",
    },
  });

  const routes = {
    ...routeConfig("report", PRICES.report, "Generate a structured health report from recent notes"),
    ...routeConfig("prep", PRICES.prep, "Generate an appointment prep sheet from recent notes"),
    ...routeConfig("letter", PRICES.letter, "Draft an advocacy letter (leave, accommodation, insurance)"),
    ...routeConfig("action-items", PRICES["action-items"], "Extract prioritized action items from recent notes"),
    ...routeConfig("questions", PRICES.questions, "Generate a categorized appointment question bank"),
    ...routeConfig("debrief", PRICES.debrief, "Turn fresh visit notes into a structured post-visit debrief"),
    ...routeConfig(
      "full-package",
      PRICES["full-package"],
      "Run all 6 skills at once and return one combined document (discounted bundle)"
    ),
  };

  return paymentMiddleware(routes, resourceServer);
}
