-- Add clock_alarms table for multi-device sync
CREATE TABLE IF NOT EXISTS clock_alarms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  time TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  repeat_days JSONB DEFAULT '[]'::jsonb,
  sound TEXT DEFAULT 'default',
  vibrate BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE clock_alarms ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own alarms"
  ON clock_alarms
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_clock_alarms_user_id ON clock_alarms(user_id);
CREATE INDEX idx_clock_alarms_enabled ON clock_alarms(enabled) WHERE deleted_at IS NULL;

-- Updated_at trigger
CREATE TRIGGER set_clock_alarms_updated_at
  BEFORE UPDATE ON clock_alarms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
