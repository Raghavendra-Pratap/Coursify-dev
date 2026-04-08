-- Ensure courses table allows INSERT when the current user is setting themselves as creator.
-- Run this if you see "new row violates row-level security policy for table courses" when creating a course.
-- Common causes: not signed in (auth.uid() is null), missing INSERT policy after custom RLS changes,
-- or client inserts without a JWT. The app creates new courses via POST /api/instructor/courses/new
-- (service role); set SUPABASE_SERVICE_ROLE_KEY on the server so that path works.

DROP POLICY IF EXISTS "Users can create their own courses" ON courses;
CREATE POLICY "Users can create their own courses" ON courses
  FOR INSERT WITH CHECK (auth.uid() = created_by);
