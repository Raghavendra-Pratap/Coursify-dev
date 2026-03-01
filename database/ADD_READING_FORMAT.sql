-- Add optional format for native reading body: 'plain' | 'markdown' | 'html'
-- Run in Supabase SQL Editor if you use reading materials with HTML/Markdown.

ALTER TABLE reading_materials
  ADD COLUMN IF NOT EXISTS format TEXT DEFAULT 'plain'
  CHECK (format IN ('plain', 'markdown', 'html'));

COMMENT ON COLUMN reading_materials.format IS 'For type=native: plain (default), markdown, or html. Affects how body is rendered.';
