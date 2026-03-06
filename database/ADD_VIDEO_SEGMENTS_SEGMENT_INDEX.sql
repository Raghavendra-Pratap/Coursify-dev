-- Add segment_index to video_segments for ordering multiple segments within a video content item.
-- Used by course import-from-sheet and structure API. Run in Supabase SQL Editor if your schema doesn't have it.

ALTER TABLE video_segments ADD COLUMN IF NOT EXISTS segment_index INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN video_segments.segment_index IS '0-based order of this segment within the content item (for micro-video / import-from-sheet).';
