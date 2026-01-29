-- Migration: Document Folders
-- Adds hierarchical folder organization to the document storage system

-- ============================================================================
-- 1. Create document_folders table
-- ============================================================================
CREATE TABLE IF NOT EXISTS document_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) > 0 AND char_length(name) <= 255),
  parent_id UUID REFERENCES document_folders(id) ON DELETE CASCADE,
  color TEXT CHECK (color IS NULL OR color ~* '^#[0-9a-f]{6}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: no duplicate folder names under the same parent for a user
ALTER TABLE document_folders
  ADD CONSTRAINT uq_folder_name_per_parent
  UNIQUE (user_id, parent_id, name);

-- Partial unique index for root-level folders (parent_id IS NULL)
CREATE UNIQUE INDEX uq_folder_name_root
  ON document_folders (user_id, name)
  WHERE parent_id IS NULL;

-- Index for tree traversal
CREATE INDEX idx_document_folders_parent ON document_folders (parent_id);
CREATE INDEX idx_document_folders_user ON document_folders (user_id);

-- Auto-update updated_at
CREATE TRIGGER set_document_folders_updated_at
  BEFORE UPDATE ON document_folders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 2. Add folder_id to documents table
-- ============================================================================
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES document_folders(id) ON DELETE SET NULL;

CREATE INDEX idx_documents_folder ON documents (folder_id);

-- ============================================================================
-- 3. RLS Policies for document_folders
-- ============================================================================
ALTER TABLE document_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own folders"
  ON document_folders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own folders"
  ON document_folders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own folders"
  ON document_folders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own folders"
  ON document_folders FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages all folders"
  ON document_folders FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- 4. get_folder_tree RPC - returns full tree with document counts
-- ============================================================================
CREATE OR REPLACE FUNCTION get_folder_tree(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  parent_id UUID,
  color TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  document_count BIGINT,
  depth INT
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE folder_tree AS (
    SELECT
      f.id, f.name, f.parent_id, f.color,
      f.created_at, f.updated_at,
      0 AS depth
    FROM document_folders f
    WHERE f.user_id = p_user_id AND f.parent_id IS NULL

    UNION ALL

    SELECT
      f.id, f.name, f.parent_id, f.color,
      f.created_at, f.updated_at,
      ft.depth + 1
    FROM document_folders f
    INNER JOIN folder_tree ft ON f.parent_id = ft.id
  )
  SELECT
    ft.id, ft.name, ft.parent_id, ft.color,
    ft.created_at, ft.updated_at,
    COALESCE(dc.cnt, 0)::BIGINT AS document_count,
    ft.depth
  FROM folder_tree ft
  LEFT JOIN (
    SELECT d.folder_id, COUNT(*)::BIGINT AS cnt
    FROM documents d
    WHERE d.user_id = p_user_id AND d.status != 'archived'
    GROUP BY d.folder_id
  ) dc ON dc.folder_id = ft.id
  ORDER BY ft.depth, ft.name;
END;
$$;

-- ============================================================================
-- 5. get_folder_breadcrumb RPC - returns ancestor path
-- ============================================================================
CREATE OR REPLACE FUNCTION get_folder_breadcrumb(p_folder_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  parent_id UUID,
  depth INT
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE ancestors AS (
    SELECT f.id, f.name, f.parent_id, 0 AS depth
    FROM document_folders f
    WHERE f.id = p_folder_id

    UNION ALL

    SELECT f.id, f.name, f.parent_id, a.depth + 1
    FROM document_folders f
    INNER JOIN ancestors a ON f.id = a.parent_id
  )
  SELECT a.id, a.name, a.parent_id, a.depth
  FROM ancestors a
  ORDER BY a.depth DESC;
END;
$$;

-- ============================================================================
-- 6. Update search_documents to accept optional folder_id filter
-- ============================================================================
DROP FUNCTION IF EXISTS search_documents(UUID, vector, INT, FLOAT, TEXT, UUID, TEXT[]);

CREATE OR REPLACE FUNCTION search_documents(
  p_user_id UUID,
  p_query_embedding vector(1536),
  p_limit INT DEFAULT 10,
  p_min_similarity FLOAT DEFAULT 0.7,
  p_scope TEXT DEFAULT NULL,
  p_thread_id UUID DEFAULT NULL,
  p_file_types TEXT[] DEFAULT NULL,
  p_folder_id UUID DEFAULT NULL
)
RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  document_name TEXT,
  file_type TEXT,
  content TEXT,
  chunk_type TEXT,
  source_page INT,
  similarity FLOAT,
  metadata JSONB
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id AS chunk_id,
    d.id AS document_id,
    d.name AS document_name,
    d.file_type::TEXT,
    dc.content,
    dc.chunk_type::TEXT,
    dc.source_page,
    (1 - (dc.embedding <=> p_query_embedding))::FLOAT AS similarity,
    dc.metadata
  FROM document_chunks dc
  JOIN documents d ON dc.document_id = d.id
  WHERE d.user_id = p_user_id
    AND d.status = 'ready'
    AND (p_scope IS NULL OR d.scope = p_scope)
    AND (p_thread_id IS NULL OR d.thread_id = p_thread_id)
    AND (p_file_types IS NULL OR d.file_type::TEXT = ANY(p_file_types))
    AND (p_folder_id IS NULL OR d.folder_id = p_folder_id)
    AND dc.embedding IS NOT NULL
    AND 1 - (dc.embedding <=> p_query_embedding) >= p_min_similarity
  ORDER BY dc.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$;
