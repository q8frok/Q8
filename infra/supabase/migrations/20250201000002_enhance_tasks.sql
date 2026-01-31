-- Enhance tasks table with subtasks, tags, and AI features
-- Add new columns to existing tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_minutes INTEGER;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ai_context JSONB;

-- Create index for parent_task_id for faster subtask queries
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id);

-- Create index for tags for faster tag filtering
CREATE INDEX IF NOT EXISTS idx_tasks_tags ON tasks USING GIN(tags);

-- Create index for due_date for deadline queries
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date) WHERE due_date IS NOT NULL;

-- Create task_tags table for better tag management
CREATE TABLE IF NOT EXISTS task_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#8B5CF6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Enable RLS on task_tags
ALTER TABLE task_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for task_tags
CREATE POLICY "Users can manage their own tags"
  ON task_tags
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes for task_tags
CREATE INDEX idx_task_tags_user_id ON task_tags(user_id);

-- Updated_at trigger for task_tags
CREATE TRIGGER set_task_tags_updated_at
  BEFORE UPDATE ON task_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to get task with subtask count
CREATE OR REPLACE FUNCTION get_task_with_subtask_count(task_id UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  status TEXT,
  priority TEXT,
  tags TEXT[],
  due_date TIMESTAMPTZ,
  subtask_count BIGINT,
  completed_subtask_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.title,
    t.description,
    t.status,
    t.priority,
    t.tags,
    t.due_date,
    COUNT(st.id) as subtask_count,
    COUNT(st.id) FILTER (WHERE st.status = 'done') as completed_subtask_count
  FROM tasks t
  LEFT JOIN tasks st ON st.parent_task_id = t.id AND st.deleted_at IS NULL
  WHERE t.id = task_id AND t.deleted_at IS NULL
  GROUP BY t.id;
END;
$$ LANGUAGE plpgsql;
