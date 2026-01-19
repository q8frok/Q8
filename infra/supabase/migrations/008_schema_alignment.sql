-- ============================================================
-- Schema Alignment Migration
-- Ensures Supabase matches RxDB schema for flawless real-time sync
-- ============================================================

-- ============================================================
-- 1. FIX TASKS TABLE - Ensure title is NOT NULL
-- ============================================================

-- Ensure any null titles get a default value
UPDATE tasks SET title = 'Untitled Task' WHERE title IS NULL;

-- Make title NOT NULL if not already
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'title' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE tasks ALTER COLUMN title SET NOT NULL;
  END IF;
END $$;

-- Ensure all task columns match RxDB schema
ALTER TABLE tasks 
  ALTER COLUMN status SET DEFAULT 'todo',
  ALTER COLUMN priority SET DEFAULT 'medium',
  ALTER COLUMN sort_order SET DEFAULT 0;

-- Add index for efficient Kanban queries
CREATE INDEX IF NOT EXISTS idx_tasks_user_status_sort ON tasks(user_id, status, sort_order);

-- ============================================================
-- 2. ADD USERS_SYNC TABLE - For offline user data access
-- ============================================================

CREATE TABLE IF NOT EXISTS users_sync (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_sync_email ON users_sync(email);

DROP TRIGGER IF EXISTS update_users_sync_updated_at ON users_sync;
CREATE TRIGGER update_users_sync_updated_at
  BEFORE UPDATE ON users_sync
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE users_sync ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own sync data" ON users_sync;
CREATE POLICY "Users can view their own sync data"
  ON users_sync FOR SELECT USING (auth.uid()::text = id);

DROP POLICY IF EXISTS "Users can update their own sync data" ON users_sync;
CREATE POLICY "Users can update their own sync data"
  ON users_sync FOR UPDATE USING (auth.uid()::text = id);

-- Enable realtime for users_sync
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'users_sync'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE users_sync;
  END IF;
END $$;

-- ============================================================
-- 3. ENSURE NOTES TABLE HAS ALL REQUIRED COLUMNS
-- ============================================================

-- Add any missing columns to notes (already exists, just ensure completeness)
ALTER TABLE notes ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 0;

-- Add index for efficient sync queries
CREATE INDEX IF NOT EXISTS idx_notes_user_updated ON notes(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_user_pinned ON notes(user_id, is_pinned) WHERE is_pinned = true;
CREATE INDEX IF NOT EXISTS idx_notes_user_daily ON notes(user_id, is_daily, daily_date) WHERE is_daily = true;

-- ============================================================
-- 4. ENSURE NOTE_FOLDERS TABLE HAS ALL REQUIRED COLUMNS
-- ============================================================

-- Add index for efficient folder queries
CREATE INDEX IF NOT EXISTS idx_note_folders_user_sort ON note_folders(user_id, sort_order);

-- ============================================================
-- 5. ENSURE THREADS TABLE HAS ALL REQUIRED COLUMNS
-- ============================================================

-- Add version column for optimistic locking
ALTER TABLE threads ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 0;

-- Add index for efficient sync queries
CREATE INDEX IF NOT EXISTS idx_threads_user_updated ON threads(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_user_archived ON threads(user_id, is_archived);

-- ============================================================
-- 6. ENSURE AGENT_MEMORIES TABLE HAS ALL REQUIRED COLUMNS
-- ============================================================

-- Add index for efficient memory queries
CREATE INDEX IF NOT EXISTS idx_agent_memories_user_type ON agent_memories(user_id, memory_type);
CREATE INDEX IF NOT EXISTS idx_agent_memories_user_importance ON agent_memories(user_id, importance);
CREATE INDEX IF NOT EXISTS idx_agent_memories_user_updated ON agent_memories(user_id, updated_at DESC);

-- ============================================================
-- 7. ADD SYNC METADATA TABLE - Track sync state per collection
-- ============================================================

CREATE TABLE IF NOT EXISTS sync_checkpoints (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  collection_name TEXT NOT NULL,
  last_pulled_at TIMESTAMPTZ,
  last_pushed_at TIMESTAMPTZ,
  server_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, collection_name)
);

CREATE INDEX IF NOT EXISTS idx_sync_checkpoints_user ON sync_checkpoints(user_id);

DROP TRIGGER IF EXISTS update_sync_checkpoints_updated_at ON sync_checkpoints;
CREATE TRIGGER update_sync_checkpoints_updated_at
  BEFORE UPDATE ON sync_checkpoints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE sync_checkpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own checkpoints" ON sync_checkpoints;
CREATE POLICY "Users can manage their own checkpoints"
  ON sync_checkpoints FOR ALL USING (auth.uid()::text = user_id);

-- ============================================================
-- 8. ADD SYNC CONFLICT LOG TABLE - Track conflicts for debugging
-- ============================================================

CREATE TABLE IF NOT EXISTS sync_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  collection_name TEXT NOT NULL,
  document_id TEXT NOT NULL,
  local_version JSONB NOT NULL,
  remote_version JSONB NOT NULL,
  resolved_version JSONB NOT NULL,
  resolution_strategy TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_conflicts_user ON sync_conflicts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_collection ON sync_conflicts(collection_name, created_at DESC);

ALTER TABLE sync_conflicts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own conflicts" ON sync_conflicts;
CREATE POLICY "Users can view their own conflicts"
  ON sync_conflicts FOR SELECT USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert their own conflicts" ON sync_conflicts;
CREATE POLICY "Users can insert their own conflicts"
  ON sync_conflicts FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- ============================================================
-- 9. ENABLE REALTIME FOR ALL SYNCABLE TABLES
-- ============================================================

DO $$
BEGIN
  -- Notes
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'notes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notes;
  END IF;

  -- Note folders
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'note_folders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE note_folders;
  END IF;

  -- Threads
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'threads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE threads;
  END IF;

  -- Agent memories
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'agent_memories'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE agent_memories;
  END IF;

  -- Knowledge base
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'knowledge_base'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE knowledge_base;
  END IF;
END $$;

-- ============================================================
-- 10. CREATE HELPER FUNCTION FOR SYNC OPERATIONS
-- ============================================================

CREATE OR REPLACE FUNCTION get_changes_since(
  p_table_name TEXT,
  p_user_id TEXT,
  p_since TIMESTAMPTZ,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id TEXT,
  data JSONB,
  updated_at TIMESTAMPTZ,
  is_deleted BOOLEAN
) AS $$
BEGIN
  RETURN QUERY EXECUTE format(
    'SELECT 
      id::TEXT,
      to_jsonb(t.*) as data,
      t.updated_at,
      COALESCE(t.is_archived, false) as is_deleted
    FROM %I t
    WHERE t.user_id = $1 
      AND t.updated_at > $2
    ORDER BY t.updated_at ASC
    LIMIT $3',
    p_table_name
  ) USING p_user_id, p_since, p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_changes_since TO authenticated;
