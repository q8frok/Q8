-- ============================================================
-- Fix Tasks Table - Ensure completed column exists
-- ============================================================

-- Add completed column if it doesn't exist
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT false;

-- Update completed based on status for existing rows
UPDATE tasks SET completed = (status = 'done') WHERE completed IS NULL;

-- Make completed NOT NULL with default
ALTER TABLE tasks ALTER COLUMN completed SET DEFAULT false;
ALTER TABLE tasks ALTER COLUMN completed SET NOT NULL;

-- Drop and recreate the trigger function to handle the completed field properly
CREATE OR REPLACE FUNCTION set_task_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle status change to 'done'
  IF NEW.status = 'done' AND (OLD.status IS NULL OR OLD.status != 'done') THEN
    NEW.completed_at = COALESCE(NEW.completed_at, NOW());
    NEW.completed = true;
  -- Handle status change from 'done' to something else
  ELSIF NEW.status != 'done' AND OLD.status = 'done' THEN
    NEW.completed_at = NULL;
    NEW.completed = false;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS set_task_completed_at_trigger ON tasks;
CREATE TRIGGER set_task_completed_at_trigger
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_task_completed_at();

-- Create index on completed column
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
