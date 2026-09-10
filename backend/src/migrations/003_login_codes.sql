-- Replaces the no-proof "email in, session out" flow. A code is emailed to
-- the address, and only a correct, unexpired, unused code issues a session.
-- Storing a hash, not the raw code, so a DB read alone can't authenticate.

CREATE TABLE IF NOT EXISTS login_codes (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_codes_email ON login_codes(email);
