-- Migration: Document Tags System
-- Adds tagging support for documents

CREATE TABLE IF NOT EXISTS document_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 50),
  color TEXT CHECK (color ~* '^#[0-9a-f]{6}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS document_tag_assignments (
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES document_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (document_id, tag_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_document_tags_user ON document_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_document_tag_assignments_doc ON document_tag_assignments(document_id);
CREATE INDEX IF NOT EXISTS idx_document_tag_assignments_tag ON document_tag_assignments(tag_id);

-- RLS
ALTER TABLE document_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_tag_assignments ENABLE ROW LEVEL SECURITY;

-- Tags policies
DROP POLICY IF EXISTS "Users can view their own tags" ON document_tags;
CREATE POLICY "Users can view their own tags"
    ON document_tags FOR SELECT USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can create their own tags" ON document_tags;
CREATE POLICY "Users can create their own tags"
    ON document_tags FOR INSERT WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update their own tags" ON document_tags;
CREATE POLICY "Users can update their own tags"
    ON document_tags FOR UPDATE USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete their own tags" ON document_tags;
CREATE POLICY "Users can delete their own tags"
    ON document_tags FOR DELETE USING (auth.uid()::text = user_id);

-- Service role for tags
DROP POLICY IF EXISTS "Service role can manage all tags" ON document_tags;
CREATE POLICY "Service role can manage all tags"
    ON document_tags FOR ALL USING (auth.role() = 'service_role');

-- Tag assignments policies (through document ownership)
DROP POLICY IF EXISTS "Users can view their tag assignments" ON document_tag_assignments;
CREATE POLICY "Users can view their tag assignments"
    ON document_tag_assignments FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_tag_assignments.document_id
      AND d.user_id = auth.uid()::text
    ));

DROP POLICY IF EXISTS "Service role can manage all tag assignments" ON document_tag_assignments;
CREATE POLICY "Service role can manage all tag assignments"
    ON document_tag_assignments FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE document_tags IS 'User-defined tags for categorizing documents';
COMMENT ON TABLE document_tag_assignments IS 'Many-to-many relationship between documents and tags';
