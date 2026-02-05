# /supabase — Supabase Migration & RLS Patterns

Patterns for Supabase migrations, Row Level Security, and sync configuration.

## Auto-Invocation
This skill activates automatically when working with Supabase tables, migrations, or RLS policies.

## Migration Template

```sql
-- infra/supabase/migrations/<timestamp>_<description>.sql

-- Create table
CREATE TABLE IF NOT EXISTS public.<table_name> (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- ... columns
);

-- Enable RLS
ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read own data"
  ON public.<table_name> FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own data"
  ON public.<table_name> FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own data"
  ON public.<table_name> FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own data"
  ON public.<table_name> FOR DELETE
  USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.<table_name>
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- Indexes
CREATE INDEX idx_<table_name>_user_id ON public.<table_name>(user_id);
CREATE INDEX idx_<table_name>_updated_at ON public.<table_name>(updated_at);
```

## Rules
- Every table must have `id`, `user_id`, `created_at`, `updated_at`.
- Always enable RLS — no exceptions.
- Always create per-user CRUD policies.
- Add `updated_at` index for replication queries.
- Use `gen_random_uuid()` for UUIDs, `now()` for timestamps.
- Use `moddatetime` trigger for automatic `updated_at`.
- Column names must match RxDB schema fields exactly.
- Apply migrations via `mcp__supabase__apply_migration` tool.
