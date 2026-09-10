-- Principal-protected yield module (v1, phase 2 per spec).
-- Principal deposited into Aave is always withdrawable on demand; nothing
-- in this schema ever decrements principal_balance except withdraw().
-- No prediction-market execution lives here -- predictions.js stays a
-- separate, read-only informational route with no link to these tables.

CREATE TABLE IF NOT EXISTS vaults (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chain TEXT NOT NULL DEFAULT 'x_layer',
  asset TEXT NOT NULL DEFAULT 'USDT',
  -- Principal is always withdrawable on demand.
  principal_balance NUMERIC(38,6) NOT NULL DEFAULT 0 CHECK (principal_balance >= 0),
  deposit_tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS yield_pool (
  id SERIAL PRIMARY KEY,
  vault_id INTEGER NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  -- Cumulative yield harvested from Aave v3. Withdrawable the same as
  -- principal; nothing spends against it.
  harvested_amount NUMERIC(38,6) NOT NULL DEFAULT 0 CHECK (harvested_amount >= 0),
  last_harvest_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vaults_user_id ON vaults(user_id);
CREATE INDEX IF NOT EXISTS idx_yield_pool_vault_id ON yield_pool(vault_id);
