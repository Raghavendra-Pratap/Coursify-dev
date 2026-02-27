-- Fix RLS on lessons so course creators (and admins) can insert/update/delete lessons.
-- Run this in Supabase SQL Editor if you get: "new row violates row-level security policy for table lessons"
-- Also allows admins (user_profiles.role = 'admin') to manage any course's lessons.
-- If you use course collaborators, run database/COURSE_COLLABORATORS.sql so collaborators can edit lessons too.

-- Drop any existing lessons policies that might block INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Users can manage lessons in their courses" ON lessons;
DROP POLICY IF EXISTS "Users can insert lessons in their courses" ON lessons;
DROP POLICY IF EXISTS "Users can update lessons in their courses" ON lessons;
DROP POLICY IF EXISTS "Users can delete lessons in their courses" ON lessons;
DROP POLICY IF EXISTS "Users can insert lessons in own or collaborated courses" ON lessons;
DROP POLICY IF EXISTS "Users can update lessons in own or collaborated courses" ON lessons;
DROP POLICY IF EXISTS "Users can delete lessons in own or collaborated courses" ON lessons;

-- Helper: true if current user can manage this course (owner or admin). Returns FALSE if auth.uid() is NULL.
CREATE OR REPLACE FUNCTION public.can_manage_course(cid UUID)
RETURNS BOOLEAN AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.courses c WHERE c.id = cid AND c.created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE
   SET search_path = public;

-- Helper: true if current user can add a lesson to this module (uses definer rights). Returns FALSE if auth.uid() is NULL.
CREATE OR REPLACE FUNCTION public.can_insert_lesson_to_module(mid UUID)
RETURNS BOOLEAN AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.modules m
    JOIN public.courses c ON c.id = m.course_id
    WHERE m.id = mid
    AND (c.created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin'))
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE
   SET search_path = public;

-- Helper: true if current user can manage lessons in this module (for UPDATE/DELETE; uses definer rights).
CREATE OR REPLACE FUNCTION public.can_manage_lesson_by_module(mid UUID)
RETURNS BOOLEAN AS $$
  SELECT public.can_manage_course((SELECT m.course_id FROM public.modules m WHERE m.id = mid LIMIT 1));
$$ LANGUAGE sql SECURITY DEFINER STABLE
   SET search_path = public;

-- SELECT: so you can read lessons when loading/editing the course (owner/admin or published)
DROP POLICY IF EXISTS "Users can view lessons of accessible modules" ON lessons;
CREATE POLICY "Users can view lessons of accessible modules" ON lessons
  FOR SELECT
  USING (
    public.can_manage_course((SELECT m.course_id FROM public.modules m WHERE m.id = lessons.module_id LIMIT 1))
    OR EXISTS (
      SELECT 1 FROM public.modules m
      JOIN public.courses c ON c.id = m.course_id
      WHERE m.id = lessons.module_id AND c.status = 'published'
    )
  );

-- INSERT: use definer-rights function so policy doesn't depend on user's SELECT on modules/courses
CREATE POLICY "Users can insert lessons in their courses" ON lessons
  FOR INSERT
  WITH CHECK (public.can_insert_lesson_to_module(module_id));

-- UPDATE
CREATE POLICY "Users can update lessons in their courses" ON lessons
  FOR UPDATE
  USING (public.can_manage_lesson_by_module(module_id))
  WITH CHECK (public.can_manage_lesson_by_module(module_id));

-- DELETE
CREATE POLICY "Users can delete lessons in their courses" ON lessons
  FOR DELETE
  USING (public.can_manage_lesson_by_module(module_id));
