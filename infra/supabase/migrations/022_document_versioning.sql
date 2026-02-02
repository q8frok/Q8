-- Migration: Document Versioning & Archive
-- Adds version tracking and archive support

ALTER TABLE documents ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS parent_document_id UUID REFERENCES documents(id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_latest BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_documents_parent ON documents(parent_document_id) WHERE parent_document_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_latest ON documents(user_id, is_latest) WHERE is_latest = true;

COMMENT ON COLUMN documents.version IS 'Version number, incremented on each upload of a new version';
COMMENT ON COLUMN documents.parent_document_id IS 'Points to the original document in a version chain';
COMMENT ON COLUMN documents.is_latest IS 'True if this is the latest version in the chain';
