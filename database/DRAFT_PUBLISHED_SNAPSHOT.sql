-- Draft vs published: learners see only the last published snapshot until republish.
-- Editors (collaborators) can Save; only owner or admin can Publish/Republish.
-- Run in Supabase SQL Editor, or use Supabase MCP (plugin-supabase-supabase) execute_sql with this project.
-- See docs/EDITOR_PUBLISH_AND_OWNERSHIP.md.

-- Add columns to courses
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS published_snapshot JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS has_unpublished_changes BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN courses.published_snapshot IS 'Full course structure at last publish (title, description, modules with lessons/content). Learners read from this when present.';
COMMENT ON COLUMN courses.published_at IS 'When the course was last published.';
COMMENT ON COLUMN courses.has_unpublished_changes IS 'True after Save when course is already published; false after Publish/Republish. Used for "To republish" UI.';
