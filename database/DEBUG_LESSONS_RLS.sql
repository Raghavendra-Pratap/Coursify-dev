-- =============================================================================
-- DEBUG & FIX: "new row violates row-level security policy for table lessons"
-- Run this entire file in Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- You must be signed in to the same user that creates/edits courses.
-- =============================================================================

-- 1) See current state (run this first to debug)
SELECT 'RLS enabled on lessons?' AS check_name, relrowsecurity AS rls_enabled
  FROM pg_class WHERE relname = 'lessons';

SELECT 'Current policies on lessons:' AS info;
SELECT policyname, cmd, qual::text AS using_expr, with_check::text
  FROM pg_policies WHERE tablename = 'lessons';

-- 2) Who am I? (run while signed in via your app, then run the same in SQL Editor)
-- In SQL Editor you are "postgres" or the role used by the dashboard, so auth.uid() may be NULL here.
-- The app uses the anon key + your JWT, so auth.uid() in the app is your user id.
SELECT auth.uid() AS my_user_id;

-- 3) Drop every possible policy name that might exist on lessons (from schema, fixes, collaborators)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'lessons'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON lessons', pol.policyname);
    RAISE NOTICE 'Dropped policy: %', pol.policyname;
  END LOOP;
END $$;

-- 4) Ensure RLS is on
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

-- 5) Helper: true if current user can manage this course (owner or admin). Returns FALSE if auth.uid() is NULL.
CREATE OR REPLACE FUNCTION public.can_manage_course(cid UUID)
RETURNS BOOLEAN AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.courses c WHERE c.id = cid AND c.created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE
   SET search_path = public;

-- 6) Helper: true if current user can add a lesson to this module. Returns FALSE if auth.uid() is NULL.
CREATE OR REPLACE FUNCTION public.can_insert_lesson_to_module(mid UUID)
RETURNS BOOLEAN AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.modules m
    JOIN public.courses c ON c.id = m.course_id
    WHERE m.id = mid
    AND (c.created_by = auth.uid()
         OR EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin'))
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE
   SET search_path = public;

-- 7) Helper: true if current user can manage lessons in this module (UPDATE/DELETE)
CREATE OR REPLACE FUNCTION public.can_manage_lesson_by_module(mid UUID)
RETURNS BOOLEAN AS $$
  SELECT public.can_manage_course((SELECT m.course_id FROM public.modules m WHERE m.id = mid LIMIT 1));
$$ LANGUAGE sql SECURITY DEFINER STABLE
   SET search_path = public;

-- 8) SELECT policy so you can read lessons (required for loading course in editor)
DROP POLICY IF EXISTS "Users can view lessons of accessible modules" ON lessons;
CREATE POLICY "Users can view lessons of accessible modules" ON lessons
  FOR SELECT
  USING (
    public.can_manage_course((
      SELECT m.course_id FROM public.modules m WHERE m.id = lessons.module_id LIMIT 1
    ))
    OR EXISTS (
      SELECT 1 FROM public.modules m
      JOIN public.courses c ON c.id = m.course_id
      WHERE m.id = lessons.module_id AND c.status = 'published'
    )
  );

-- 9) INSERT policy
CREATE POLICY "Users can insert lessons in their courses" ON lessons
  FOR INSERT
  WITH CHECK (public.can_insert_lesson_to_module(module_id));

-- 10) UPDATE policy
CREATE POLICY "Users can update lessons in their courses" ON lessons
  FOR UPDATE
  USING (public.can_manage_lesson_by_module(module_id))
  WITH CHECK (public.can_manage_lesson_by_module(module_id));

-- 11) DELETE policy
CREATE POLICY "Users can delete lessons in their courses" ON lessons
  FOR DELETE
  USING (public.can_manage_lesson_by_module(module_id));

-- Done
SELECT 'Lessons RLS policies applied. Try saving the course again from the app.' AS result;
