-- Migration: Update calendar_events table for full Google Calendar sync
-- Adds missing columns required for full event data storage

-- ============================================================
-- Add missing columns to calendar_events
-- ============================================================

-- Add description column
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Add all_day flag
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS all_day BOOLEAN DEFAULT false;

-- Add Google Calendar identifiers for sync
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS google_calendar_id TEXT;

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS google_event_id TEXT;

-- Add recurrence rules (array of RRULE strings)
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS recurrence JSONB;

-- Add reminders (array of {method, minutes})
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS reminders JSONB;

-- Add event status
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed';

-- Add visibility
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'default';

-- Change attendees from count to full JSONB array
-- First add the new column
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS attendees JSONB DEFAULT '[]'::jsonb;

-- Drop the old attendees_count column if it exists
ALTER TABLE calendar_events
  DROP COLUMN IF EXISTS attendees_count;

-- ============================================================
-- Add constraints
-- ============================================================

-- Status constraint
ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_status_check;
ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_status_check
  CHECK (status IS NULL OR status IN ('confirmed', 'tentative', 'cancelled'));

-- Visibility constraint
ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_visibility_check;
ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_visibility_check
  CHECK (visibility IS NULL OR visibility IN ('default', 'public', 'private', 'confidential'));

-- ============================================================
-- Add indexes for new columns
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_calendar_events_google_calendar ON calendar_events(google_calendar_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_google_event ON calendar_events(google_event_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_all_day ON calendar_events(all_day);
CREATE INDEX IF NOT EXISTS idx_calendar_events_status ON calendar_events(status);

-- Composite index for Google sync lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_google_composite
  ON calendar_events(google_calendar_id, google_event_id);

-- ============================================================
-- Grant service role access for API operations
-- ============================================================

-- The service role already has full access via RLS bypass,
-- but we ensure the policies work correctly for both scenarios

COMMENT ON TABLE calendar_events IS 'Google Calendar events synced for the CalendarWidget';
COMMENT ON COLUMN calendar_events.google_calendar_id IS 'Google Calendar ID (e.g., primary, user@gmail.com)';
COMMENT ON COLUMN calendar_events.google_event_id IS 'Google Calendar Event ID for sync';
COMMENT ON COLUMN calendar_events.attendees IS 'JSONB array of attendee objects with email, displayName, responseStatus';
COMMENT ON COLUMN calendar_events.recurrence IS 'JSONB array of RRULE strings for recurring events';
COMMENT ON COLUMN calendar_events.reminders IS 'JSONB array of {method, minutes} reminder objects';
