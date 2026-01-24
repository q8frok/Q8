-- Migration: Fix calendar_events unique constraint for multi-account support
-- The previous unique constraint on (google_calendar_id, google_event_id) doesn't work
-- with multi-account support where the same calendar can be accessed by multiple accounts.

-- ============================================================
-- Drop the old unique constraint
-- ============================================================

DROP INDEX IF EXISTS idx_calendar_events_google_composite;

-- ============================================================
-- Create new unique constraint that includes google_account_id
-- ============================================================

-- This ensures that the same event synced from different accounts is stored separately
-- The id field format is now: {google_account_id}_{calendar_id}_{event_id}
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_account_composite
  ON calendar_events(google_account_id, google_calendar_id, google_event_id);

-- ============================================================
-- Comments
-- ============================================================

COMMENT ON INDEX idx_calendar_events_account_composite IS 'Unique constraint for calendar events including account ID for multi-account support';
