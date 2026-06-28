-- Q&A threads (course_questions). Run after courses, enrollments, course_collaborators exist.

CREATE OR REPLACE FUNCTION public.is_course_owner_or_collaborator(cid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM courses c WHERE c.id = cid AND c.created_by = auth.uid())
     OR EXISTS (SELECT 1 FROM course_collaborators cc WHERE cc.course_id = cid AND cc.user_id = auth.uid())
     OR EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE TABLE IF NOT EXISTS course_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  module_id UUID REFERENCES modules(id) ON DELETE SET NULL,
  lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  parent_id UUID REFERENCES course_questions(id) ON DELETE CASCADE,
  asked_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  answer_text TEXT,
  answered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  answered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_questions_course_id ON course_questions(course_id);
CREATE INDEX IF NOT EXISTS idx_course_questions_parent_id ON course_questions(parent_id);
CREATE INDEX IF NOT EXISTS idx_course_questions_asked_by ON course_questions(asked_by);

ALTER TABLE course_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view questions for enrolled or owned courses" ON course_questions;
CREATE POLICY "Users can view questions for enrolled or owned courses"
  ON course_questions FOR SELECT USING (
    EXISTS (SELECT 1 FROM enrollments e WHERE e.course_id = course_questions.course_id AND e.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM courses c WHERE c.id = course_questions.course_id AND c.created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM course_collaborators cc WHERE cc.course_id = course_questions.course_id AND cc.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Enrolled users can insert questions" ON course_questions;
CREATE POLICY "Enrolled users can insert questions"
  ON course_questions FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM enrollments e WHERE e.course_id = course_questions.course_id AND e.user_id = auth.uid())
    AND asked_by = auth.uid()
  );

DROP POLICY IF EXISTS "Course owner or collaborator can update (answer) questions" ON course_questions;
CREATE POLICY "Course owner or collaborator can update (answer) questions"
  ON course_questions FOR UPDATE USING (is_course_owner_or_collaborator(course_id));
