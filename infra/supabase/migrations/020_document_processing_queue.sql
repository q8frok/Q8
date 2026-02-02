-- Migration: Document Processing Queue
-- Adds content_hash for dedup (Phase 4) and ensures documents work with agent_jobs queue

-- Add content_hash column for Phase 4 dedup
ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_documents_content_hash ON documents(content_hash) WHERE content_hash IS NOT NULL;

-- Ensure agent_type check allows document_processor
-- The agent_jobs table uses TEXT for agent_type, so no enum change needed.
-- Just add a comment for documentation.
COMMENT ON COLUMN documents.content_hash IS 'SHA-256 hash of file content for duplicate detection';
