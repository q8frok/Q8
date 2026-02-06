-- Migration: Chat stream idempotency records
-- Ensures duplicate /api/chat/stream sends can be replayed safely per (user_id, thread_id, request_id).

CREATE TABLE IF NOT EXISTS chat_stream_idempotency (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),

  -- Replay metadata
  user_message TEXT,
  assistant_message TEXT,
  run_thread_id UUID REFERENCES threads(id) ON DELETE CASCADE,
  run_agent TEXT,
  created_thread BOOLEAN NOT NULL DEFAULT false,

  -- Lifecycle
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chat_stream_idempotency_unique UNIQUE (user_id, thread_id, request_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_stream_idempotency_lookup
  ON chat_stream_idempotency(user_id, thread_id, request_id);

CREATE INDEX IF NOT EXISTS idx_chat_stream_idempotency_expires_at
  ON chat_stream_idempotency(expires_at);

DROP TRIGGER IF EXISTS update_chat_stream_idempotency_updated_at ON chat_stream_idempotency;
CREATE TRIGGER update_chat_stream_idempotency_updated_at
  BEFORE UPDATE ON chat_stream_idempotency
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE chat_stream_idempotency ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own stream idempotency records" ON chat_stream_idempotency;
CREATE POLICY "Users can view their own stream idempotency records"
  ON chat_stream_idempotency FOR SELECT USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert their own stream idempotency records" ON chat_stream_idempotency;
CREATE POLICY "Users can insert their own stream idempotency records"
  ON chat_stream_idempotency FOR INSERT WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update their own stream idempotency records" ON chat_stream_idempotency;
CREATE POLICY "Users can update their own stream idempotency records"
  ON chat_stream_idempotency FOR UPDATE USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Service role can manage all stream idempotency records" ON chat_stream_idempotency;
CREATE POLICY "Service role can manage all stream idempotency records"
  ON chat_stream_idempotency FOR ALL USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION cleanup_chat_stream_idempotency_records()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM chat_stream_idempotency WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_chat_stream_idempotency_records() IS
  'Deletes expired chat stream idempotency rows. Run periodically (e.g., every 15 minutes via pg_cron or a worker).';
