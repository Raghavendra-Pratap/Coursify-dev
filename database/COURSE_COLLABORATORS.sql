-- Instructor collaboration: course_collaborators table and RLS
-- Run in Supabase SQL Editor. Allows course owners to add co-instructors who can edit the course and see learners/analytics.

-- Helper: true if current user is course owner, collaborator, or admin (admin = invisible backdoor for all courses)
CREATE OR REPLACE FUNCTION public.is_course_owner_or_collaborator(cid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM courses c WHERE c.id = cid AND c.created_by = auth.uid())
     OR EXISTS (SELECT 1 FROM course_collaborators cc WHERE cc.course_id = cid AND cc.user_id = auth.uid())
     OR EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Table: course_collaborators
CREATE TABLE IF NOT EXISTS course_collaborators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(course_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_course_collaborators_course_id ON course_collaborators(course_id);
CREATE INDEX IF NOT EXISTS idx_course_collaborators_user_id ON course_collaborators(user_id);
ALTER TABLE course_collaborators ENABLE ROW LEVEL SECURITY;

-- RLS: course_collaborators — view if you're owner or a collaborator; insert/delete only owner
CREATE POLICY "Course owner and collaborators can view course_collaborators" ON course_collaborators
  FOR SELECT USING (public.is_course_owner_or_collaborator(course_id));

CREATE POLICY "Only course owner can add collaborators" ON course_collaborators
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM courses c WHERE c.id = course_id AND c.created_by = auth.uid())
  );

CREATE POLICY "Only course owner can remove collaborators" ON course_collaborators
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM courses c WHERE c.id = course_id AND c.created_by = auth.uid())
  );

-- Allow collaborator to remove themselves
CREATE POLICY "Collaborators can remove themselves" ON course_collaborators
  FOR DELETE USING (user_id = auth.uid());

-- Courses: allow SELECT and UPDATE for owner OR collaborator; DELETE only owner
DROP POLICY IF EXISTS "Users can view their own courses" ON courses;
CREATE POLICY "Users can view their own or collaborated courses" ON courses
  FOR SELECT USING (public.is_course_owner_or_collaborator(id));

DROP POLICY IF EXISTS "Users can update their own courses" ON courses;
CREATE POLICY "Users can update their own or collaborated courses" ON courses
  FOR UPDATE USING (public.is_course_owner_or_collaborator(id));

DROP POLICY IF EXISTS "Users can delete their own courses" ON courses;
CREATE POLICY "Only course owner can delete course" ON courses
  FOR DELETE USING (EXISTS (SELECT 1 FROM courses c WHERE c.id = courses.id AND c.created_by = auth.uid()));

-- New course creation (browser client or any direct insert): keep explicit INSERT policy
DROP POLICY IF EXISTS "Users can create their own courses" ON courses;
CREATE POLICY "Users can create their own courses" ON courses
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Modules: allow collaborator to select/create/update/delete
DROP POLICY IF EXISTS "Users can view modules of accessible courses" ON modules;
CREATE POLICY "Users can view modules of accessible courses" ON modules
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM courses c WHERE c.id = modules.course_id AND (c.created_by = auth.uid() OR EXISTS (SELECT 1 FROM course_collaborators cc WHERE cc.course_id = c.id AND cc.user_id = auth.uid())))
    OR EXISTS (SELECT 1 FROM courses c WHERE c.id = modules.course_id AND c.status = 'published')
  );

DROP POLICY IF EXISTS "Users can create modules in their courses" ON modules;
CREATE POLICY "Users can create modules in own or collaborated courses" ON modules
  FOR INSERT WITH CHECK (public.is_course_owner_or_collaborator(course_id));

DROP POLICY IF EXISTS "Users can update modules in their courses" ON modules;
CREATE POLICY "Users can update modules in own or collaborated courses" ON modules
  FOR UPDATE USING (public.is_course_owner_or_collaborator(course_id));

DROP POLICY IF EXISTS "Users can delete modules in their courses" ON modules;
CREATE POLICY "Users can delete modules in own or collaborated courses" ON modules
  FOR DELETE USING (public.is_course_owner_or_collaborator(course_id));

-- Lessons: allow collaborator
DROP POLICY IF EXISTS "Users can view lessons of accessible modules" ON lessons;
CREATE POLICY "Users can view lessons of accessible modules" ON lessons
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM modules m
      JOIN courses c ON c.id = m.course_id
      WHERE m.id = lessons.module_id
      AND (c.created_by = auth.uid() OR EXISTS (SELECT 1 FROM course_collaborators cc WHERE cc.course_id = c.id AND cc.user_id = auth.uid()) OR c.status = 'published')
    )
  );

DROP POLICY IF EXISTS "Users can insert lessons in their courses" ON lessons;
CREATE POLICY "Users can insert lessons in own or collaborated courses" ON lessons
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM modules m
      JOIN courses c ON c.id = m.course_id
      WHERE m.id = lessons.module_id AND public.is_course_owner_or_collaborator(c.id)
    )
  );

DROP POLICY IF EXISTS "Users can update lessons in their courses" ON lessons;
CREATE POLICY "Users can update lessons in own or collaborated courses" ON lessons
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM modules m
      JOIN courses c ON c.id = m.course_id
      WHERE m.id = lessons.module_id AND public.is_course_owner_or_collaborator(c.id)
    )
  );

DROP POLICY IF EXISTS "Users can delete lessons in their courses" ON lessons;
CREATE POLICY "Users can delete lessons in own or collaborated courses" ON lessons
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM modules m
      JOIN courses c ON c.id = m.course_id
      WHERE m.id = lessons.module_id AND public.is_course_owner_or_collaborator(c.id)
    )
  );

-- Content items: allow collaborator
DROP POLICY IF EXISTS "Users can view content items of accessible lessons" ON content_items;
CREATE POLICY "Users can view content items of accessible lessons" ON content_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lessons l
      JOIN modules m ON m.id = l.module_id
      JOIN courses c ON c.id = m.course_id
      WHERE l.id = content_items.lesson_id
      AND (c.created_by = auth.uid() OR EXISTS (SELECT 1 FROM course_collaborators cc WHERE cc.course_id = c.id AND cc.user_id = auth.uid()) OR c.status = 'published')
    )
  );

DROP POLICY IF EXISTS "Users can manage content items in their courses" ON content_items;
CREATE POLICY "Users can manage content items in own or collaborated courses" ON content_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM lessons l
      JOIN modules m ON m.id = l.module_id
      JOIN courses c ON c.id = m.course_id
      WHERE l.id = content_items.lesson_id AND public.is_course_owner_or_collaborator(c.id)
    )
  );

-- Course analytics: allow collaborator to view
DROP POLICY IF EXISTS "Users can view analytics for their courses" ON course_analytics;
CREATE POLICY "Users can view analytics for own or collaborated courses" ON course_analytics
  FOR SELECT USING (public.is_course_owner_or_collaborator(course_id));
