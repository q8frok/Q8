-- Memory 2.0 Schema
-- Supabase-first memory with hybrid retrieval and importance decay

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Enhanced memories table with embeddings and decay
ALTER TABLE agent_memories ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE agent_memories ADD COLUMN IF NOT EXISTS access_count INTEGER DEFAULT 0;
ALTER TABLE agent_memories ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE agent_memories ADD COLUMN IF NOT EXISTS decay_factor DECIMAL(4,3) DEFAULT 1.000;
ALTER TABLE agent_memories ADD COLUMN IF NOT EXISTS source_thread_id UUID REFERENCES threads(id) ON DELETE SET NULL;
ALTER TABLE agent_memories ADD COLUMN IF NOT EXISTS source_message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL;
ALTER TABLE agent_memories ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'verified', 'contradicted'));
ALTER TABLE agent_memories ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES agent_memories(id) ON DELETE SET NULL;
ALTER TABLE agent_memories ADD COLUMN IF NOT EXISTS provenance JSONB DEFAULT '{}';
ALTER TABLE agent_memories ADD COLUMN IF NOT EXISTS keywords TEXT[] DEFAULT '{}';

-- Create indexes for hybrid search
-- Using HNSW index for better memory efficiency and no training data requirements
CREATE INDEX IF NOT EXISTS idx_memories_embedding ON agent_memories
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_memories_keywords ON agent_memories USING GIN (keywords);
CREATE INDEX IF NOT EXISTS idx_memories_importance ON agent_memories (importance DESC);
CREATE INDEX IF NOT EXISTS idx_memories_decay ON agent_memories (decay_factor DESC);
CREATE INDEX IF NOT EXISTS idx_memories_user_type ON agent_memories (user_id, memory_type);
CREATE INDEX IF NOT EXISTS idx_memories_active ON agent_memories (user_id, decay_factor DESC)
    WHERE superseded_by IS NULL AND verification_status != 'contradicted';

-- Function to calculate effective importance with decay
CREATE OR REPLACE FUNCTION calculate_memory_score(
    base_importance INTEGER,
    decay_factor DECIMAL,
    access_count INTEGER,
    last_accessed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
) RETURNS DECIMAL AS $$
DECLARE
    recency_boost DECIMAL;
    access_boost DECIMAL;
    age_days DECIMAL;
BEGIN
    age_days := EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400.0;

    -- Recency boost (higher for recent memories)
    recency_boost := CASE
        WHEN age_days < 1 THEN 0.2
        WHEN age_days < 7 THEN 0.1
        WHEN age_days < 30 THEN 0.05
        ELSE 0
    END;

    -- Access boost (frequently accessed memories are more important)
    access_boost := LEAST(access_count * 0.02, 0.2);

    -- Combined score
    RETURN (base_importance * decay_factor) + recency_boost + access_boost;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to apply time-based decay
CREATE OR REPLACE FUNCTION apply_memory_decay() RETURNS TRIGGER AS $$
BEGIN
    -- Apply decay based on memory type
    -- Preferences decay slowly, facts decay faster
    IF NEW.memory_type = 'preference' THEN
        NEW.decay_factor := GREATEST(0.5, 1 - (EXTRACT(EPOCH FROM (NOW() - NEW.created_at)) / 86400.0 / 180));
    ELSIF NEW.memory_type = 'fact' THEN
        NEW.decay_factor := GREATEST(0.3, 1 - (EXTRACT(EPOCH FROM (NOW() - NEW.created_at)) / 86400.0 / 90));
    ELSE
        NEW.decay_factor := GREATEST(0.2, 1 - (EXTRACT(EPOCH FROM (NOW() - NEW.created_at)) / 86400.0 / 30));
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER memory_decay_trigger
    BEFORE INSERT OR UPDATE ON agent_memories
    FOR EACH ROW EXECUTE FUNCTION apply_memory_decay();

-- Hybrid search function combining vector similarity and keyword matching
CREATE OR REPLACE FUNCTION search_memories_hybrid(
    p_user_id UUID,
    p_query_embedding vector(1536) DEFAULT NULL,
    p_keywords TEXT[] DEFAULT '{}',
    p_query_text TEXT DEFAULT '',
    p_memory_types TEXT[] DEFAULT '{}',
    p_min_importance INTEGER DEFAULT 0,
    p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
    id UUID,
    content TEXT,
    memory_type TEXT,
    importance INTEGER,
    created_at TIMESTAMPTZ,
    relevance_score DECIMAL,
    match_type TEXT,
    provenance JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH vector_matches AS (
        -- Vector similarity search (if embedding provided)
        SELECT
            m.id,
            m.content,
            m.memory_type,
            m.importance,
            m.created_at,
            m.provenance,
            1 - (m.embedding <=> p_query_embedding) AS similarity,
            'semantic' AS match_source
        FROM agent_memories m
        WHERE m.user_id = p_user_id
            AND m.embedding IS NOT NULL
            AND p_query_embedding IS NOT NULL
            AND m.superseded_by IS NULL
            AND m.verification_status != 'contradicted'
            AND (array_length(p_memory_types, 1) IS NULL OR m.memory_type = ANY(p_memory_types))
            AND m.importance >= p_min_importance
        ORDER BY m.embedding <=> p_query_embedding
        LIMIT p_limit * 2
    ),
    keyword_matches AS (
        -- Keyword/exact match search
        SELECT
            m.id,
            m.content,
            m.memory_type,
            m.importance,
            m.created_at,
            m.provenance,
            CASE
                WHEN m.content ILIKE '%' || p_query_text || '%' THEN 1.0
                WHEN m.keywords && p_keywords THEN 0.8
                ELSE 0.5
            END AS similarity,
            CASE
                WHEN m.content ILIKE '%' || p_query_text || '%' THEN 'exact'
                ELSE 'keyword'
            END AS match_source
        FROM agent_memories m
        WHERE m.user_id = p_user_id
            AND m.superseded_by IS NULL
            AND m.verification_status != 'contradicted'
            AND (array_length(p_memory_types, 1) IS NULL OR m.memory_type = ANY(p_memory_types))
            AND m.importance >= p_min_importance
            AND (
                (p_query_text != '' AND m.content ILIKE '%' || p_query_text || '%')
                OR (array_length(p_keywords, 1) > 0 AND m.keywords && p_keywords)
            )
        LIMIT p_limit * 2
    ),
    combined AS (
        SELECT DISTINCT ON (id)
            COALESCE(v.id, k.id) AS id,
            COALESCE(v.content, k.content) AS content,
            COALESCE(v.memory_type, k.memory_type) AS memory_type,
            COALESCE(v.importance, k.importance) AS importance,
            COALESCE(v.created_at, k.created_at) AS created_at,
            COALESCE(v.provenance, k.provenance) AS provenance,
            -- Combine scores with priority: exact > semantic > keyword
            CASE
                WHEN k.match_source = 'exact' THEN k.similarity + 0.5
                WHEN v.similarity IS NOT NULL AND k.similarity IS NOT NULL THEN
                    GREATEST(v.similarity, k.similarity) + 0.2
                ELSE COALESCE(v.similarity, k.similarity, 0.5)
            END AS relevance_score,
            COALESCE(k.match_source, v.match_source) AS match_type
        FROM vector_matches v
        FULL OUTER JOIN keyword_matches k ON v.id = k.id
    )
    SELECT
        c.id,
        c.content,
        c.memory_type,
        c.importance,
        c.created_at,
        c.relevance_score,
        c.match_type,
        c.provenance
    FROM combined c
    ORDER BY c.relevance_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to update memory access stats
CREATE OR REPLACE FUNCTION update_memory_access(p_memory_id UUID) RETURNS VOID AS $$
BEGIN
    UPDATE agent_memories
    SET access_count = access_count + 1,
        last_accessed_at = NOW()
    WHERE id = p_memory_id;
END;
$$ LANGUAGE plpgsql;

-- Function to mark memory as superseded (conflict resolution)
CREATE OR REPLACE FUNCTION supersede_memory(
    p_old_memory_id UUID,
    p_new_memory_id UUID,
    p_reason TEXT DEFAULT 'Updated information'
) RETURNS VOID AS $$
BEGIN
    UPDATE agent_memories
    SET superseded_by = p_new_memory_id,
        provenance = provenance || jsonb_build_object(
            'superseded_at', NOW(),
            'superseded_reason', p_reason
        )
    WHERE id = p_old_memory_id;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON FUNCTION search_memories_hybrid IS 'Hybrid search combining vector similarity with keyword/exact matching for high precision memory retrieval';
COMMENT ON FUNCTION calculate_memory_score IS 'Calculates effective memory importance considering base importance, decay, access frequency, and recency';
