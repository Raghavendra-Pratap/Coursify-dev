-- Fix RLS on video_segments so course creators can save and load video links/segments.
-- Without these policies, INSERT (on Save) and SELECT (on Load for edit) are denied.
-- This version is for video_segments that link to LESSONS (column: lesson_id).
-- If your table has content_item_id instead, use FIX_VIDEO_SEGMENTS_RLS_CONTENT_ITEMS.sql.

-- Drop any existing policies (in case of duplicates or old names)
DROP POLICY IF EXISTS "Users can view video segments of accessible content" ON video_segments;
DROP POLICY IF EXISTS "Users can manage video segments in their courses" ON video_segments;
DROP POLICY IF EXISTS "Users can view video segments" ON video_segments;
DROP POLICY IF EXISTS "Users can manage video segments" ON video_segments;
DROP POLICY IF EXISTS "Users can insert video segments in their courses" ON video_segments;
DROP POLICY IF EXISTS "Users can update video segments in their courses" ON video_segments;
DROP POLICY IF EXISTS "Users can delete video segments in their courses" ON video_segments;

-- SELECT: instructor can load segments when editing; anyone can view segments of published courses
CREATE POLICY "Users can view video segments of accessible content" ON video_segments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lessons l
      JOIN modules m ON m.id = l.module_id
      JOIN courses c ON c.id = m.course_id
      WHERE l.id = video_segments.lesson_id
      AND (c.created_by = auth.uid() OR c.status = 'published')
    )
  );

-- INSERT: only course owner can add segments
CREATE POLICY "Users can insert video segments in their courses" ON video_segments
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM lessons l
      JOIN modules m ON m.id = l.module_id
      JOIN courses c ON c.id = m.course_id
      WHERE l.id = video_segments.lesson_id
      AND c.created_by = auth.uid()
    )
  );

-- UPDATE: only course owner can update segments
CREATE POLICY "Users can update video segments in their courses" ON video_segments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM lessons l
      JOIN modules m ON m.id = l.module_id
      JOIN courses c ON c.id = m.course_id
      WHERE l.id = video_segments.lesson_id
      AND c.created_by = auth.uid()
    )
  );

-- DELETE: only course owner can delete (e.g. when course is re-saved and modules are replaced)
CREATE POLICY "Users can delete video segments in their courses" ON video_segments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM lessons l
      JOIN modules m ON m.id = l.module_id
      JOIN courses c ON c.id = m.course_id
      WHERE l.id = video_segments.lesson_id
      AND c.created_by = auth.uid()
    )
  );
