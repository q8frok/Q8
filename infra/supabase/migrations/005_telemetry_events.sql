-- Telemetry Events Table
-- Centralized observability for routing, tools, memory, and errors

CREATE TABLE IF NOT EXISTS telemetry_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL CHECK (event_type IN (
        'routing_decision',
        'model_selection',
        'tool_execution',
        'memory_retrieval',
        'response_generated',
        'user_feedback',
        'error'
    )),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for querying telemetry
CREATE INDEX IF NOT EXISTS idx_telemetry_user_id ON telemetry_events(user_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_thread_id ON telemetry_events(thread_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_event_type ON telemetry_events(event_type);
CREATE INDEX IF NOT EXISTS idx_telemetry_created_at ON telemetry_events(created_at DESC);

-- Partial indexes for specific event types (for faster querying)
CREATE INDEX IF NOT EXISTS idx_telemetry_routing ON telemetry_events(created_at DESC)
    WHERE event_type = 'routing_decision';

CREATE INDEX IF NOT EXISTS idx_telemetry_errors ON telemetry_events(created_at DESC)
    WHERE event_type = 'error';

CREATE INDEX IF NOT EXISTS idx_telemetry_feedback ON telemetry_events(user_id, created_at DESC)
    WHERE event_type = 'user_feedback';

-- RLS policies
ALTER TABLE telemetry_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own telemetry
CREATE POLICY "Users can view own telemetry" ON telemetry_events
    FOR SELECT USING (auth.uid() = user_id);

-- Only service role can insert (server-side telemetry collection)
CREATE POLICY "Service role insert telemetry" ON telemetry_events
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Service role has full access for analytics
CREATE POLICY "Service role full access" ON telemetry_events
    FOR ALL USING (auth.role() = 'service_role');

-- Aggregate views for analytics dashboard

-- Routing success rate by agent (last 24h)
CREATE OR REPLACE VIEW routing_success_24h AS
SELECT
    (metadata->>'selectedAgent')::text AS agent,
    COUNT(*) AS total_requests,
    SUM(CASE WHEN (metadata->>'success')::boolean THEN 1 ELSE 0 END) AS successful,
    AVG((metadata->>'latencyMs')::numeric) AS avg_latency_ms,
    AVG((metadata->>'confidence')::numeric) AS avg_confidence
FROM telemetry_events
WHERE event_type = 'routing_decision'
    AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY (metadata->>'selectedAgent')::text;

-- Tool execution stats (last 24h)
CREATE OR REPLACE VIEW tool_stats_24h AS
SELECT
    (metadata->>'toolName')::text AS tool_name,
    (metadata->>'agent')::text AS agent,
    COUNT(*) AS total_executions,
    SUM(CASE WHEN (metadata->>'success')::boolean THEN 1 ELSE 0 END) AS successful,
    AVG((metadata->>'durationMs')::numeric) AS avg_duration_ms
FROM telemetry_events
WHERE event_type = 'tool_execution'
    AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY (metadata->>'toolName')::text, (metadata->>'agent')::text;

-- User feedback summary (last 7d)
CREATE OR REPLACE VIEW feedback_summary_7d AS
SELECT
    (metadata->>'feedbackType')::text AS feedback_type,
    (metadata->>'agent')::text AS agent,
    COUNT(*) AS count
FROM telemetry_events
WHERE event_type = 'user_feedback'
    AND created_at > NOW() - INTERVAL '7 days'
GROUP BY (metadata->>'feedbackType')::text, (metadata->>'agent')::text;

-- Error rate by type (last 24h)
CREATE OR REPLACE VIEW error_rate_24h AS
SELECT
    (metadata->>'errorType')::text AS error_type,
    (metadata->>'agent')::text AS agent,
    COUNT(*) AS error_count,
    SUM(CASE WHEN (metadata->>'recoverable')::boolean THEN 1 ELSE 0 END) AS recoverable_count
FROM telemetry_events
WHERE event_type = 'error'
    AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY (metadata->>'errorType')::text, (metadata->>'agent')::text;

-- Function to update memory access count in batch
CREATE OR REPLACE FUNCTION update_memory_access_batch(p_memory_ids UUID[])
RETURNS VOID AS $$
BEGIN
    UPDATE agent_memories
    SET access_count = access_count + 1,
        last_accessed_at = NOW()
    WHERE id = ANY(p_memory_ids);
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE telemetry_events IS 'Centralized telemetry for routing decisions, tool executions, memory retrieval, and errors';
COMMENT ON VIEW routing_success_24h IS 'Aggregated routing success metrics for the past 24 hours';
COMMENT ON VIEW tool_stats_24h IS 'Tool execution statistics for the past 24 hours';
COMMENT ON VIEW feedback_summary_7d IS 'User feedback summary for the past 7 days';
COMMENT ON VIEW error_rate_24h IS 'Error rate by type and agent for the past 24 hours';
