-- Add support for reading content items (run in Supabase SQL Editor)
-- Allows Create Course to persist reading blocks (URL or native text).

-- 1. Allow 'reading' in content_items
ALTER TABLE content_items DROP CONSTRAINT IF EXISTS content_items_content_type_check;
ALTER TABLE content_items ADD CONSTRAINT content_items_content_type_check
  CHECK (content_type IN ('video', 'quiz', 'form', 'reading'));

-- 2. Reading materials (one row per reading content item)
CREATE TABLE IF NOT EXISTS reading_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('url', 'native')),
  url TEXT,
  body TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reading_materials_content_item ON reading_materials(content_item_id);
ALTER TABLE reading_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reading materials follow content_items access" ON reading_materials FOR ALL USING (
  EXISTS (SELECT 1 FROM content_items WHERE content_items.id = reading_materials.content_item_id)
);
