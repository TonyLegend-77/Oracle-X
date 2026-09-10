import { pool } from "../db.js";
import * as walletClient from "../walletClient.js";

// Every mutating function here runs inside a transaction with a row lock
// on the vault (and yield_pool, where relevant) so concurrent requests
// can't double-spend the same principal or yield. Read-only helpers don't
// need a lock.

async function getOrCreateVault(client, userId, { chain = "x_layer", asset = "USDT" } = {}) {
  const existing = await client.query(
    `SELECT * FROM vaults WHERE user_id = $1 AND chain = $2 AND asset = $3`,
    [userId, chain, asset]
  );
  if (existing.rows.length) return existing.rows[0];

  const created = await client.query(
    `INSERT INTO vaults (user_id, chain, asset) VALUES ($1, $2, $3) RETURNING *`,
    [userId, chain, asset]
  );
  const vault = created.rows[0];

  await client.query(`INSERT INTO yield_pool (vault_id) VALUES ($1)`, [vault.id]);

  return vault;
}

// Deposits `amount` of principal into Aave on the user's behalf. Principal
// deposited here is tracked separately from yield and is always
// withdrawable; nothing else in this module is allowed to spend it.
export async function deposit(userId, amount, opts = {}) {
  if (!(amount > 0)) throw new Error("Deposit amount must be positive");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const vault = await getOrCreateVault(client, userId, opts);

    const txHash = await walletClient.depositToAave({
      vaultId: vault.id,
      amount,
      chain: vault.chain,
    });

    const updated = await client.query(
      `UPDATE vaults
       SET principal_balance = principal_balance + $1,
           deposit_tx_hash = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [amount, txHash, vault.id]
    );

    await client.query("COMMIT");
    return updated.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Withdraws principal back to the user. Deliberately has no dependency on
// yield_pool: yield and principal are tracked and withdrawn separately.
export async function withdraw(userId, amount, opts = {}) {
  if (!(amount > 0)) throw new Error("Withdraw amount must be positive");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT * FROM vaults WHERE user_id = $1 AND chain = $2 AND asset = $3 FOR UPDATE`,
      [userId, opts.chain || "x_layer", opts.asset || "USDT"]
    );
    const vault = rows[0];
    if (!vault) throw new Error("No vault found for this user");
    if (Number(vault.principal_balance) < amount) {
      throw new Error("Insufficient principal balance");
    }

    await walletClient.withdrawFromAave({ vaultId: vault.id, amount, chain: vault.chain });

    const updated = await client.query(
      `UPDATE vaults
       SET principal_balance = principal_balance - $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [amount, vault.id]
    );

    await client.query("COMMIT");
    return updated.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Pulls accrued interest out of Aave and into the yield_pool as a
// withdrawable balance. Never touches principal_balance.
export async function harvestYield(userId, opts = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT v.*, yp.id AS yield_pool_id
       FROM vaults v
       JOIN yield_pool yp ON yp.vault_id = v.id
       WHERE v.user_id = $1 AND v.chain = $2 AND v.asset = $3
       FOR UPDATE OF v, yp`,
      [userId, opts.chain || "x_layer", opts.asset || "USDT"]
    );
    const vault = rows[0];
    if (!vault) throw new Error("No vault found for this user");

    const accrued = await walletClient.getAccruedYield({ vaultId: vault.id, chain: vault.chain });
    if (!(accrued > 0)) {
      await client.query("COMMIT");
      return { harvested: 0 };
    }

    await walletClient.harvestYield({ vaultId: vault.id, amount: accrued, chain: vault.chain });

    const updated = await client.query(
      `UPDATE yield_pool
       SET harvested_amount = harvested_amount + $1,
           last_harvest_at = NOW(),
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [accrued, vault.yield_pool_id]
    );

    await client.query("COMMIT");
    return { harvested: accrued, yieldPool: updated.rows[0] };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Read-only: total yield harvested so far for this vault.
export async function getHarvestedYield(userId, opts = {}) {
  const { rows } = await pool.query(
    `SELECT yp.harvested_amount
     FROM vaults v
     JOIN yield_pool yp ON yp.vault_id = v.id
     WHERE v.user_id = $1 AND v.chain = $2 AND v.asset = $3`,
    [userId, opts.chain || "x_layer", opts.asset || "USDT"]
  );
  if (!rows.length) return { harvested_amount: 0 };
  return rows[0];
}

// Read-only: principal balance, exposed separately so callers never
// confuse it with harvested yield.
export async function getPrincipalBalance(userId, opts = {}) {
  const { rows } = await pool.query(
    `SELECT principal_balance FROM vaults WHERE user_id = $1 AND chain = $2 AND asset = $3`,
    [userId, opts.chain || "x_layer", opts.asset || "USDT"]
  );
  return rows.length ? Number(rows[0].principal_balance) : 0;
}
