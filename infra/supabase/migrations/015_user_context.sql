-- User Context Table (The Memex)
-- Global user context that all agents read before acting
-- Stores preferences, habits, schedules, and bio-rhythm data

-- Create user_context table
CREATE TABLE IF NOT EXISTS user_context (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    context_type TEXT NOT NULL CHECK (context_type IN (
        'preference',      -- User preferences (communication style, UI, etc.)
        'habit',           -- Learned behavior patterns
        'schedule',        -- Work hours, typical routines
        'bio_rhythm',      -- Sleep/wake patterns, energy levels
        'relationship',    -- People and their relationships
        'goal',            -- User goals and objectives
        'fact'             -- Personal facts (birthday, location, etc.)
    )),
    key TEXT NOT NULL,
    value JSONB NOT NULL DEFAULT '{}',
    confidence DECIMAL(3,2) DEFAULT 1.00 CHECK (confidence >= 0 AND confidence <= 1),
    source_agent TEXT,               -- Which agent learned this
    source_thread_id UUID REFERENCES threads(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ,          -- Optional expiration
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure unique key per user per context type
    UNIQUE(user_id, context_type, key)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_context_user_id ON user_context(user_id);
CREATE INDEX IF NOT EXISTS idx_user_context_type ON user_context(user_id, context_type);
CREATE INDEX IF NOT EXISTS idx_user_context_key ON user_context(user_id, key);
-- Partial index for non-expired context only (can't use NOW() as it's not immutable)
CREATE INDEX IF NOT EXISTS idx_user_context_active ON user_context(user_id)
    WHERE expires_at IS NULL;

-- Enable RLS
ALTER TABLE user_context ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own context" ON user_context
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own context" ON user_context
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own context" ON user_context
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own context" ON user_context
    FOR DELETE USING (auth.uid() = user_id);

-- Service role can access all (for agent updates)
CREATE POLICY "Service role full access" ON user_context
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to update timestamp on change
CREATE OR REPLACE FUNCTION update_user_context_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_context_updated
    BEFORE UPDATE ON user_context
    FOR EACH ROW EXECUTE FUNCTION update_user_context_timestamp();

-- Function to get user context for agent prompts
CREATE OR REPLACE FUNCTION get_user_context_summary(p_user_id UUID)
RETURNS TABLE (
    context_type TEXT,
    key TEXT,
    value JSONB,
    confidence DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        uc.context_type,
        uc.key,
        uc.value,
        uc.confidence
    FROM user_context uc
    WHERE uc.user_id = p_user_id
        AND (uc.expires_at IS NULL OR uc.expires_at > NOW())
        AND uc.confidence >= 0.5  -- Only return confident context
    ORDER BY
        CASE uc.context_type
            WHEN 'preference' THEN 1
            WHEN 'fact' THEN 2
            WHEN 'habit' THEN 3
            WHEN 'schedule' THEN 4
            WHEN 'bio_rhythm' THEN 5
            WHEN 'relationship' THEN 6
            WHEN 'goal' THEN 7
        END,
        uc.confidence DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to upsert user context (for agents to write back learnings)
CREATE OR REPLACE FUNCTION upsert_user_context(
    p_user_id UUID,
    p_context_type TEXT,
    p_key TEXT,
    p_value JSONB,
    p_confidence DECIMAL DEFAULT 1.0,
    p_source_agent TEXT DEFAULT NULL,
    p_source_thread_id UUID DEFAULT NULL,
    p_expires_at TIMESTAMPTZ DEFAULT NULL
) RETURNS user_context AS $$
DECLARE
    result user_context;
BEGIN
    INSERT INTO user_context (
        user_id, context_type, key, value, confidence,
        source_agent, source_thread_id, expires_at
    ) VALUES (
        p_user_id, p_context_type, p_key, p_value, p_confidence,
        p_source_agent, p_source_thread_id, p_expires_at
    )
    ON CONFLICT (user_id, context_type, key)
    DO UPDATE SET
        value = EXCLUDED.value,
        confidence = GREATEST(user_context.confidence, EXCLUDED.confidence),
        source_agent = COALESCE(EXCLUDED.source_agent, user_context.source_agent),
        source_thread_id = COALESCE(EXCLUDED.source_thread_id, user_context.source_thread_id),
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()
    RETURNING * INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE user_context IS 'Global user context (The Memex) - stores preferences, habits, schedules, and bio-rhythm data for all agents';
COMMENT ON COLUMN user_context.context_type IS 'Type of context: preference, habit, schedule, bio_rhythm, relationship, goal, fact';
COMMENT ON COLUMN user_context.key IS 'Unique identifier for this context item within its type';
COMMENT ON COLUMN user_context.value IS 'JSONB value containing the context data';
COMMENT ON COLUMN user_context.confidence IS 'Confidence level (0-1) in this context being accurate';
COMMENT ON COLUMN user_context.source_agent IS 'Which agent learned/set this context';
COMMENT ON FUNCTION get_user_context_summary IS 'Get all active user context for agent prompt injection';
COMMENT ON FUNCTION upsert_user_context IS 'Insert or update user context with conflict resolution';
