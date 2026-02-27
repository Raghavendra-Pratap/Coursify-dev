-- RLS for video_segments when the table has content_item_id (main app schema: lessons -> content_items -> video_segments).
-- Use this only if your video_segments table has a column content_item_id (not lesson_id).
-- If you get "column video_segments.content_item_id does not exist", use FIX_VIDEO_SEGMENTS_RLS.sql instead (lesson_id version).

DROP POLICY IF EXISTS "Users can view video segments of accessible content" ON video_segments;
DROP POLICY IF EXISTS "Users can insert video segments in their courses" ON video_segments;
DROP POLICY IF EXISTS "Users can update video segments in their courses" ON video_segments;
DROP POLICY IF EXISTS "Users can delete video segments in their courses" ON video_segments;

CREATE POLICY "Users can view video segments of accessible content" ON video_segments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM content_items ci
      JOIN lessons l ON l.id = ci.lesson_id
      JOIN modules m ON m.id = l.module_id
      JOIN courses c ON c.id = m.course_id
      WHERE ci.id = video_segments.content_item_id
      AND (c.created_by = auth.uid() OR c.status = 'published')
    )
  );

CREATE POLICY "Users can insert video segments in their courses" ON video_segments
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM content_items ci
      JOIN lessons l ON l.id = ci.lesson_id
      JOIN modules m ON m.id = l.module_id
      JOIN courses c ON c.id = m.course_id
      WHERE ci.id = video_segments.content_item_id
      AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update video segments in their courses" ON video_segments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM content_items ci
      JOIN lessons l ON l.id = ci.lesson_id
      JOIN modules m ON m.id = l.module_id
      JOIN courses c ON c.id = m.course_id
      WHERE ci.id = video_segments.content_item_id
      AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete video segments in their courses" ON video_segments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM content_items ci
      JOIN lessons l ON l.id = ci.lesson_id
      JOIN modules m ON m.id = l.module_id
      JOIN courses c ON c.id = m.course_id
      WHERE ci.id = video_segments.content_item_id
      AND c.created_by = auth.uid()
    )
  );
