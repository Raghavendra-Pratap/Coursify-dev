-- Ensure courses table allows INSERT when the current user is setting themselves as creator.
-- Run this if you see "new row violates row-level security policy for table courses" when creating a course.
-- Common cause: not signed in (auth.uid() is null) or dummy credentials — sign in with a real Supabase Auth user.

DROP POLICY IF EXISTS "Users can create their own courses" ON courses;
CREATE POLICY "Users can create their own courses" ON courses
  FOR INSERT WITH CHECK (auth.uid() = created_by);
