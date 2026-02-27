-- Add last_accessed_at to enrollments if your table was created before this column existed.
-- Run in Supabase SQL Editor if you want to track when users last opened a course.
-- The app works without this column; progress_percentage and completed_at are enough for My learning.

ALTER TABLE enrollments
ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ DEFAULT NOW();
