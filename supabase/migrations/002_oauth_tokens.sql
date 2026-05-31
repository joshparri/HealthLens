-- OAuth tokens table
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  provider text NOT NULL,
  account_id text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  raw_response jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS unique_oauth_account ON oauth_tokens (provider, account_id, user_id);
