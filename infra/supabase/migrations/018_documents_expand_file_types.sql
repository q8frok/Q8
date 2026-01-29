-- Migration: Expand document file types
-- Adds pptx/ppt to file_type CHECK constraint
-- Updates storage bucket to allow image and PPTX MIME types

-- ============================================================
-- Update file_type CHECK constraint to include pptx/ppt
-- ============================================================

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_file_type_check;
ALTER TABLE documents ADD CONSTRAINT documents_file_type_check CHECK (file_type IN (
  'pdf',
  'docx',
  'doc',
  'txt',
  'md',
  'csv',
  'json',
  'xlsx',
  'xls',
  'code',
  'pptx',
  'ppt',
  'image',
  'other'
));

-- ============================================================
-- REQUIRED: Storage Bucket MIME Types Update
-- Go to Supabase Dashboard > Storage > documents bucket > Settings
-- Add ALL of the following to the allowed MIME types list:
-- ============================================================
--
-- Existing (should already be present):
--   application/pdf
--   application/msword
--   application/vnd.openxmlformats-officedocument.wordprocessingml.document
--   text/plain
--   text/markdown
--   text/csv
--   application/json
--   application/vnd.ms-excel
--   application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
--
-- NEW - Must add for PPTX and image support:
--   application/vnd.openxmlformats-officedocument.presentationml.presentation
--   application/vnd.ms-powerpoint
--   image/png
--   image/jpeg
--   image/gif
--   image/webp
--   image/svg+xml
--
-- Alternatively, remove MIME type restrictions entirely to allow all file types.
-- The code already validates file types before upload.
