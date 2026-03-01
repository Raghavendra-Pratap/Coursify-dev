-- One-time use tracking for webhook quiz tokens (prevents replay attacks).
-- Token hash = SHA-256 of the token string; we reject if hash already exists.

CREATE TABLE IF NOT EXISTS webhook_quiz_token_used (
  token_hash TEXT PRIMARY KEY,
  used_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optional: cleanup old rows to avoid unbounded growth (e.g. run daily)
-- DELETE FROM webhook_quiz_token_used WHERE used_at < NOW() - INTERVAL '7 days';

COMMENT ON TABLE webhook_quiz_token_used IS 'Tracks used webhook quiz tokens to prevent replay; do not expose.';
