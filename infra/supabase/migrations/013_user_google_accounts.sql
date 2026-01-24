-- Migration: Multi-Google Account Support
-- Allows users to link multiple Google accounts for Calendar, Gmail, Drive integrations

-- ============================================================
-- User Google Accounts Table
-- ============================================================

CREATE TABLE IF NOT EXISTS user_google_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,

  -- Google account identifiers
  google_account_id TEXT NOT NULL,  -- Google's unique account ID (sub claim)
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,

  -- OAuth tokens (stored server-side for security)
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,

  -- Granted scopes for this account
  scopes TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Account metadata
  is_primary BOOLEAN DEFAULT false,
  label TEXT,  -- User-defined label like "Work", "Personal"

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_user_google_account UNIQUE (user_id, google_account_id)
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_user_google_accounts_user_id
  ON user_google_accounts(user_id);

CREATE INDEX IF NOT EXISTS idx_user_google_accounts_email
  ON user_google_accounts(email);

CREATE INDEX IF NOT EXISTS idx_user_google_accounts_google_id
  ON user_google_accounts(google_account_id);

CREATE INDEX IF NOT EXISTS idx_user_google_accounts_primary
  ON user_google_accounts(user_id, is_primary)
  WHERE is_primary = true;

-- ============================================================
-- Triggers
-- ============================================================

DROP TRIGGER IF EXISTS update_user_google_accounts_updated_at ON user_google_accounts;
CREATE TRIGGER update_user_google_accounts_updated_at
  BEFORE UPDATE ON user_google_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE user_google_accounts ENABLE ROW LEVEL SECURITY;

-- Users can only view their own linked accounts
DROP POLICY IF EXISTS "Users can view their own google accounts" ON user_google_accounts;
CREATE POLICY "Users can view their own google accounts"
  ON user_google_accounts FOR SELECT
  USING (auth.uid()::text = user_id);

-- Users can insert their own accounts
DROP POLICY IF EXISTS "Users can insert their own google accounts" ON user_google_accounts;
CREATE POLICY "Users can insert their own google accounts"
  ON user_google_accounts FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Users can update their own accounts
DROP POLICY IF EXISTS "Users can update their own google accounts" ON user_google_accounts;
CREATE POLICY "Users can update their own google accounts"
  ON user_google_accounts FOR UPDATE
  USING (auth.uid()::text = user_id);

-- Users can delete their own accounts
DROP POLICY IF EXISTS "Users can delete their own google accounts" ON user_google_accounts;
CREATE POLICY "Users can delete their own google accounts"
  ON user_google_accounts FOR DELETE
  USING (auth.uid()::text = user_id);

-- Service role bypass for API operations
DROP POLICY IF EXISTS "Service role has full access to google accounts" ON user_google_accounts;
CREATE POLICY "Service role has full access to google accounts"
  ON user_google_accounts FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- Helper function to ensure only one primary account per user
-- ============================================================

CREATE OR REPLACE FUNCTION ensure_single_primary_google_account()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting this account as primary, unset others
  IF NEW.is_primary = true THEN
    UPDATE user_google_accounts
    SET is_primary = false
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_single_primary_google_account_trigger ON user_google_accounts;
CREATE TRIGGER ensure_single_primary_google_account_trigger
  BEFORE INSERT OR UPDATE OF is_primary ON user_google_accounts
  FOR EACH ROW
  WHEN (NEW.is_primary = true)
  EXECUTE FUNCTION ensure_single_primary_google_account();

-- ============================================================
-- Update calendar_events to track source account
-- ============================================================

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS google_account_id TEXT;

CREATE INDEX IF NOT EXISTS idx_calendar_events_google_account
  ON calendar_events(google_account_id);

-- ============================================================
-- Comments
-- ============================================================

COMMENT ON TABLE user_google_accounts IS 'Stores multiple linked Google accounts per user for Calendar, Gmail, Drive integrations';
COMMENT ON COLUMN user_google_accounts.google_account_id IS 'Google unique account ID from OAuth sub claim';
COMMENT ON COLUMN user_google_accounts.scopes IS 'Array of granted OAuth scopes like calendar, gmail.readonly, drive.readonly';
COMMENT ON COLUMN user_google_accounts.is_primary IS 'Primary account used for default operations';
COMMENT ON COLUMN user_google_accounts.label IS 'User-defined label like Work, Personal, School';
