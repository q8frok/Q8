-- Proactive Briefs Table
-- Stores generated briefs, alerts, and proactive notifications

CREATE TABLE IF NOT EXISTS proactive_briefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    brief_type TEXT NOT NULL CHECK (brief_type IN (
        'morning_brief',      -- Daily morning summary
        'evening_summary',    -- End of day recap
        'alert',              -- Urgent notification
        'reminder'            -- Scheduled reminder
    )),
    content JSONB NOT NULL DEFAULT '{}',
    read_at TIMESTAMPTZ,     -- When user acknowledged/read the brief
    dismissed_at TIMESTAMPTZ, -- When user dismissed without reading
    scheduled_for TIMESTAMPTZ, -- For scheduled briefs
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_proactive_briefs_user ON proactive_briefs(user_id);
CREATE INDEX IF NOT EXISTS idx_proactive_briefs_type ON proactive_briefs(user_id, brief_type);
CREATE INDEX IF NOT EXISTS idx_proactive_briefs_unread ON proactive_briefs(user_id, read_at)
    WHERE read_at IS NULL AND dismissed_at IS NULL;
-- Partial index for scheduled briefs (can't use NOW() as it's not immutable)
CREATE INDEX IF NOT EXISTS idx_proactive_briefs_scheduled ON proactive_briefs(scheduled_for)
    WHERE scheduled_for IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proactive_briefs_created ON proactive_briefs(created_at DESC);

-- Enable RLS
ALTER TABLE proactive_briefs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own briefs" ON proactive_briefs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own briefs" ON proactive_briefs
    FOR UPDATE USING (auth.uid() = user_id);

-- Service role can insert briefs (for cron jobs)
CREATE POLICY "Service role can insert briefs" ON proactive_briefs
    FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can read all briefs" ON proactive_briefs
    FOR SELECT USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to get latest unread brief of a type
CREATE OR REPLACE FUNCTION get_latest_unread_brief(
    p_user_id UUID,
    p_brief_type TEXT DEFAULT NULL
) RETURNS proactive_briefs AS $$
    SELECT *
    FROM proactive_briefs
    WHERE user_id = p_user_id
        AND read_at IS NULL
        AND dismissed_at IS NULL
        AND (p_brief_type IS NULL OR brief_type = p_brief_type)
    ORDER BY created_at DESC
    LIMIT 1;
$$ LANGUAGE sql;

-- Function to mark brief as read
CREATE OR REPLACE FUNCTION mark_brief_read(p_brief_id UUID) RETURNS VOID AS $$
BEGIN
    UPDATE proactive_briefs
    SET read_at = NOW()
    WHERE id = p_brief_id
        AND user_id = auth.uid()
        AND read_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to get briefs for a date range
CREATE OR REPLACE FUNCTION get_briefs_for_period(
    p_user_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_brief_type TEXT DEFAULT NULL
) RETURNS SETOF proactive_briefs AS $$
    SELECT *
    FROM proactive_briefs
    WHERE user_id = p_user_id
        AND created_at >= p_start_date
        AND created_at <= p_end_date
        AND (p_brief_type IS NULL OR brief_type = p_brief_type)
    ORDER BY created_at DESC;
$$ LANGUAGE sql;

-- Push subscription table for web push notifications
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    keys JSONB NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,

    UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own subscriptions" ON push_subscriptions
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to subscriptions" ON push_subscriptions
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Comments
COMMENT ON TABLE proactive_briefs IS 'Proactive notifications: morning briefs, alerts, reminders';
COMMENT ON TABLE push_subscriptions IS 'Web push notification subscriptions';
COMMENT ON FUNCTION get_latest_unread_brief IS 'Get the most recent unread brief of a given type';
