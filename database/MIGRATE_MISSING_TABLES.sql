-- Add missing tables for Coursify (run in Supabase SQL Editor if your DB doesn't have these yet)
-- Your DB already has: courses, modules, lessons, video_segments, enrollments, progress, user_profiles,
--   course_analytics, learner_preferences, learner_activity, google_drive_connections, course_templates

-- 1. Content Items (required: lessons → content_items → video/quiz/form; app expects this layer)
CREATE TABLE IF NOT EXISTS content_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('video', 'quiz', 'form')),
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lesson_id, order_index)
);
CREATE INDEX IF NOT EXISTS idx_content_items_lesson_id ON content_items(lesson_id);
CREATE INDEX IF NOT EXISTS idx_content_items_order ON content_items(lesson_id, order_index);
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view content_items of accessible lessons" ON content_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM lessons
    JOIN modules ON modules.id = lessons.module_id
    JOIN courses ON courses.id = modules.course_id
    WHERE lessons.id = content_items.lesson_id
    AND (courses.created_by = auth.uid() OR courses.status = 'published')
  )
);
CREATE POLICY "Users can manage content_items in their courses" ON content_items FOR ALL USING (
  EXISTS (
    SELECT 1 FROM lessons
    JOIN modules ON modules.id = lessons.module_id
    JOIN courses ON courses.id = modules.course_id
    WHERE lessons.id = content_items.lesson_id AND courses.created_by = auth.uid()
  )
);

-- 2. Quizzes (for quiz content items)
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  passing_score INTEGER DEFAULT 70 CHECK (passing_score >= 0 AND passing_score <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quizzes_content_item ON quizzes(content_item_id);
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Quizzes follow content_items access" ON quizzes FOR ALL USING (
  EXISTS (SELECT 1 FROM content_items WHERE content_items.id = quizzes.content_item_id)
);

-- 3. Quiz Questions
CREATE TABLE IF NOT EXISTS quiz_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'true_false', 'short_answer')),
  options JSONB,
  correct_answer TEXT NOT NULL,
  points INTEGER DEFAULT 1,
  required BOOLEAN DEFAULT TRUE,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON quiz_questions(quiz_id);
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Quiz questions follow quiz access" ON quiz_questions FOR ALL USING (
  EXISTS (SELECT 1 FROM quizzes WHERE quizzes.id = quiz_questions.quiz_id)
);

-- 4. Forms
CREATE TABLE IF NOT EXISTS forms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_forms_content_item ON forms(content_item_id);
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Forms follow content_items access" ON forms FOR ALL USING (
  EXISTS (SELECT 1 FROM content_items WHERE content_items.id = forms.content_item_id)
);

-- 5. Form Fields
CREATE TABLE IF NOT EXISTS form_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'textarea', 'select', 'checkbox', 'radio')),
  options JSONB,
  required BOOLEAN DEFAULT FALSE,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_form_fields_form_id ON form_fields(form_id);
ALTER TABLE form_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Form fields follow form access" ON form_fields FOR ALL USING (
  EXISTS (SELECT 1 FROM forms WHERE forms.id = form_fields.form_id)
);

-- 6. Course Versions (optional; for version history)
CREATE TABLE IF NOT EXISTS course_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  changes_description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_current BOOLEAN DEFAULT FALSE,
  course_snapshot JSONB,
  UNIQUE(course_id, version_number)
);
CREATE INDEX IF NOT EXISTS idx_course_versions_course_id ON course_versions(course_id);
ALTER TABLE course_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage versions of their courses" ON course_versions FOR ALL USING (
  EXISTS (SELECT 1 FROM courses WHERE courses.id = course_versions.course_id AND courses.created_by = auth.uid())
);

-- 7. Quiz Attempts (for tracking quiz submissions)
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  passed BOOLEAN NOT NULL,
  answers JSONB NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_enrollment ON quiz_attempts(enrollment_id, quiz_id);
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own quiz attempts" ON quiz_attempts FOR SELECT USING (
  EXISTS (SELECT 1 FROM enrollments WHERE enrollments.id = quiz_attempts.enrollment_id AND enrollments.user_id = auth.uid())
);
CREATE POLICY "Users can insert own quiz attempts" ON quiz_attempts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM enrollments WHERE enrollments.id = quiz_attempts.enrollment_id AND enrollments.user_id = auth.uid())
);

-- 8. Learner Invites (invite-by-email flow)
CREATE TABLE IF NOT EXISTS learner_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'accepted', 'expired')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_learner_invites_email ON learner_invites(email);
CREATE INDEX IF NOT EXISTS idx_learner_invites_created_by ON learner_invites(created_by);
ALTER TABLE learner_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own learner invites" ON learner_invites FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY "Users can insert own learner invites" ON learner_invites FOR INSERT WITH CHECK (auth.uid() = created_by);

-- 9. Learner Reminders (send reminder to learner; persisted for audit)
CREATE TABLE IF NOT EXISTS learner_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_learner_reminders_user_id ON learner_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_learner_reminders_created_by ON learner_reminders(created_by);
ALTER TABLE learner_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view reminders they created" ON learner_reminders FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY "Users can insert reminders" ON learner_reminders FOR INSERT WITH CHECK (auth.uid() = created_by);
