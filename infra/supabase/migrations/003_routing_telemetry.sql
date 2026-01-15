-- Routing Telemetry and Performance Metrics Tables
-- For Phase 2: Adaptive Router + Policy Engine

-- Routing telemetry for tracking agent selection decisions
CREATE TABLE IF NOT EXISTS routing_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,

    -- Routing decision details
    selected_agent TEXT NOT NULL,
    routing_source TEXT NOT NULL CHECK (routing_source IN ('llm', 'heuristic', 'fallback')),
    confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    fallback_used BOOLEAN NOT NULL DEFAULT false,

    -- Performance metrics
    latency_ms INTEGER NOT NULL,
    success BOOLEAN NOT NULL DEFAULT true,
    tools_used TEXT[] DEFAULT '{}',

    -- User feedback (explicit or implicit)
    user_feedback TEXT CHECK (user_feedback IN ('positive', 'negative', 'retry', 'manual_switch')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_routing_telemetry_user_id ON routing_telemetry(user_id);
CREATE INDEX IF NOT EXISTS idx_routing_telemetry_created_at ON routing_telemetry(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_routing_telemetry_agent ON routing_telemetry(selected_agent);
-- Note: Partial index with NOW() not allowed, using regular index on created_at instead
-- Query planner handles time-based filtering efficiently

-- Implicit feedback signals (retries, manual switches, tool failures)
CREATE TABLE IF NOT EXISTS routing_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    agent TEXT NOT NULL,
    signal_type TEXT NOT NULL CHECK (signal_type IN ('retry', 'manual_switch', 'tool_failure', 'timeout')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_routing_feedback_user_id ON routing_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_routing_feedback_created_at ON routing_feedback(created_at DESC);

-- Row Level Security
ALTER TABLE routing_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE routing_feedback ENABLE ROW LEVEL SECURITY;

-- Users can only see their own telemetry
CREATE POLICY "Users can view own telemetry" ON routing_telemetry
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own telemetry" ON routing_telemetry
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own feedback" ON routing_feedback
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feedback" ON routing_feedback
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role has full access for analytics
CREATE POLICY "Service role full access telemetry" ON routing_telemetry
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access feedback" ON routing_feedback
    FOR ALL USING (auth.role() = 'service_role');

-- Comment
COMMENT ON TABLE routing_telemetry IS 'Tracks routing decisions and outcomes for adaptive agent selection';
COMMENT ON TABLE routing_feedback IS 'Captures implicit user feedback signals for routing optimization';
