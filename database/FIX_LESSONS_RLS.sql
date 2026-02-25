-- Fix RLS on lessons so course creators can insert/update/delete lessons.
-- Run this in Supabase SQL Editor if you get: "new row violates row-level security policy for table lessons"
-- Ensures the signed-in user (auth.uid()) can manage lessons in courses they created.

-- Drop the single "manage" policy if it exists (so we can replace with explicit INSERT/UPDATE/DELETE)
DROP POLICY IF EXISTS "Users can manage lessons in their courses" ON lessons;

-- Allow INSERT when the lesson's module belongs to a course created by the current user
CREATE POLICY "Users can insert lessons in their courses" ON lessons
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM modules
      JOIN courses ON courses.id = modules.course_id
      WHERE modules.id = lessons.module_id
      AND courses.created_by = auth.uid()
    )
  );

-- Allow UPDATE when the lesson's module belongs to a course created by the current user
CREATE POLICY "Users can update lessons in their courses" ON lessons
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM modules
      JOIN courses ON courses.id = modules.course_id
      WHERE modules.id = lessons.module_id
      AND courses.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM modules
      JOIN courses ON courses.id = modules.course_id
      WHERE modules.id = lessons.module_id
      AND courses.created_by = auth.uid()
    )
  );

-- Allow DELETE when the lesson's module belongs to a course created by the current user
CREATE POLICY "Users can delete lessons in their courses" ON lessons
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM modules
      JOIN courses ON courses.id = modules.course_id
      WHERE modules.id = lessons.module_id
      AND courses.created_by = auth.uid()
    )
  );
