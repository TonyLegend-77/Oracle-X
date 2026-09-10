// Stub until the OnchainOS skill + shared Agentic Wallet are wired up
// (one-time local step: `npx skills add okx/onchainos-skills`, same
// blocker/fix as anchor.js and AgentPress). Every method here throws
// NOT_WIRED until that's done. Fill in the real calls in one place so
// vaultService.js never has to change when it happens.
//
// CUSTODY MODEL, read before wiring this up:
// - This is the shared platform-managed Agentic Wallet (source: 'mhc' in
//   the ledger, per the spec), not a user's own wallet and not
//   self-custody. Users never hold a private key here. That means MHC,
//   not the user, is the on-chain owner of any funds in this wallet, and
//   any compromise of the Agentic Wallet's credentials is a compromise of
//   every user's principal and yield at once. Treat the wallet secret the
//   same way you'd treat a database credential that can move money:
//   never log it, never put it in a route handler, never expose it to the
//   frontend, rotate it if it's ever touched a client-visible surface.
// - Because it's shared with AgentPress, tag every transaction with
//   source: 'mhc' at write time so a wallet-level incident (drained
//   balance, stuck nonce) can be attributed to the right product instead
//   of discovered by diffing two products' books after the fact.
//
// CONTRACT-ADDRESS WARNING:
// - Aave v3's pool address on X Layer must come from this hardcoded
//   allowlist, never from a request body, query param, or any other
//   caller-supplied value. A vault flow that accepts an address as input
//   is a direct path to draining the wallet into an attacker's contract.
//   If a second chain or a second Aave deployment is ever added, add it
//   here explicitly rather than making the address a parameter.
const KNOWN_CONTRACTS = Object.freeze({
  x_layer: {
    aave_v3_pool: null, // TODO: fill in the audited Aave v3 Pool address for X Layer before going live
    usdt: null, // TODO: fill in X Layer USDT token address
  },
});

function assertKnownContract(chain, key) {
  const chainContracts = KNOWN_CONTRACTS[chain];
  if (!chainContracts) throw new Error(`Unknown chain: ${chain}`);
  const address = chainContracts[key];
  if (!address) {
    throw new Error(
      `No allowlisted address configured for ${chain}/${key}. Refusing to proceed with an unverified address.`
    );
  }
  return address;
}

class WalletNotWiredError extends Error {
  constructor(action) {
    super(
      `Wallet action "${action}" not wired up yet. Run 'npx skills add okx/onchainos-skills' locally, then implement this call against the shared Agentic Wallet.`
    );
    this.code = "NOT_WIRED";
  }
}

// Deposit USDT from the user-facing flow into the Aave v3 pool on X Layer,
// on behalf of a given vault. Returns a tx hash once wired.
export async function depositToAave({ vaultId, amount, chain = "x_layer" }) {
  assertKnownContract(chain, "aave_v3_pool");
  throw new WalletNotWiredError("depositToAave");
}

// Withdraw principal (never yield-only) back out of Aave to the vault's
// available balance. Principal withdrawal must never be blocked by an
// open prediction position; that invariant lives in vaultService, not here.
export async function withdrawFromAave({ vaultId, amount, chain = "x_layer" }) {
  assertKnownContract(chain, "aave_v3_pool");
  throw new WalletNotWiredError("withdrawFromAave");
}

// Reads accrued interest on the aToken balance without moving funds.
// Read-only, safe to call more liberally than the mutating methods above.
export async function getAccruedYield({ vaultId, chain = "x_layer" }) {
  assertKnownContract(chain, "aave_v3_pool");
  throw new WalletNotWiredError("getAccruedYield");
}

// Pulls harvested interest out of the aToken position and into the
// wallet's spendable, withdrawable balance. Never touches principal.
export async function harvestYield({ vaultId, amount, chain = "x_layer" }) {
  assertKnownContract(chain, "aave_v3_pool");
  throw new WalletNotWiredError("harvestYield");
}

export { WalletNotWiredError, KNOWN_CONTRACTS };
