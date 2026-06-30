-- Run once in Supabase SQL Editor if assessment-only courses fail to save/publish
-- or invites show "Course is not published yet" after clicking Publish.
--
-- Combines: ADD_EXTERNAL_ASSESSMENTS.sql + DRAFT_PUBLISHED_SNAPSHOT.sql

-- === Assessment content type + tables ===
ALTER TABLE content_items DROP CONSTRAINT IF EXISTS content_items_content_type_check;
ALTER TABLE content_items ADD CONSTRAINT content_items_content_type_check
  CHECK (content_type IN ('video', 'reading', 'quiz', 'form', 'assessment'));

CREATE TABLE IF NOT EXISTS external_assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'assessment_pro' CHECK (provider IN ('assessment_pro')),
  assessment_pro_assessment_id UUID NOT NULL,
  company_slug TEXT NOT NULL DEFAULT 'coursify-bsoc-space',
  access_mode TEXT NOT NULL DEFAULT 'lms_embed'
    CHECK (access_mode IN ('lms_embed', 'proctored_portal')),
  passing_score INTEGER DEFAULT 70 CHECK (passing_score >= 0 AND passing_score <= 100),
  duration_minutes INTEGER,
  title TEXT,
  description TEXT,
  presentation TEXT NOT NULL DEFAULT 'embed'
    CHECK (presentation IN ('embed', 'new_tab')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (content_item_id),
  CONSTRAINT presentation_matches_mode CHECK (
    (access_mode = 'lms_embed' AND presentation = 'embed')
    OR (access_mode = 'proctored_portal' AND presentation = 'new_tab')
  )
);

CREATE TABLE IF NOT EXISTS external_assessment_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  external_assessment_id UUID NOT NULL REFERENCES external_assessments(id) ON DELETE CASCADE,
  assessment_pro_session_id UUID,
  assessment_pro_invitation_id UUID,
  launch_token TEXT,
  candidate_token TEXT,
  embed_url TEXT,
  take_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'in_progress', 'submitted', 'pending_manual_grade', 'graded', 'expired', 'cancelled'
  )),
  auto_score NUMERIC,
  final_score NUMERIC,
  passed BOOLEAN,
  manual_grading_required BOOLEAN DEFAULT false,
  graded_at TIMESTAMPTZ,
  graded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (enrollment_id, external_assessment_id)
);

CREATE TABLE IF NOT EXISTS external_assessment_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES external_assessment_sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL,
  question_type TEXT NOT NULL,
  answer JSONB NOT NULL,
  auto_score NUMERIC,
  manual_score NUMERIC,
  max_score NUMERIC,
  needs_manual_grade BOOLEAN DEFAULT false,
  reviewer_notes TEXT,
  graded_at TIMESTAMPTZ,
  graded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (session_id, question_id)
);

CREATE TABLE IF NOT EXISTS webhook_assessment_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_external_assessments_content_item ON external_assessments(content_item_id);
CREATE INDEX IF NOT EXISTS idx_ext_assessment_sessions_enrollment ON external_assessment_sessions(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_ext_assessment_sessions_status ON external_assessment_sessions(status);
CREATE INDEX IF NOT EXISTS idx_ext_assessment_responses_session ON external_assessment_responses(session_id);

ALTER TABLE external_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_assessment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_assessment_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_assessment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "External assessments follow content_items access" ON external_assessments;
CREATE POLICY "External assessments follow content_items access" ON external_assessments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM content_items WHERE content_items.id = external_assessments.content_item_id)
  );

DROP POLICY IF EXISTS "Course owners manage external assessments" ON external_assessments;
CREATE POLICY "Course owners manage external assessments" ON external_assessments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM content_items ci
      JOIN lessons l ON l.id = ci.lesson_id
      JOIN modules m ON m.id = l.module_id
      JOIN courses c ON c.id = m.course_id
      WHERE ci.id = external_assessments.content_item_id AND c.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Learners view own assessment sessions" ON external_assessment_sessions;
CREATE POLICY "Learners view own assessment sessions" ON external_assessment_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM enrollments e
      WHERE e.id = external_assessment_sessions.enrollment_id AND e.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Instructors view course assessment sessions" ON external_assessment_sessions;
CREATE POLICY "Instructors view course assessment sessions" ON external_assessment_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM external_assessments ea
      JOIN content_items ci ON ci.id = ea.content_item_id
      JOIN lessons l ON l.id = ci.lesson_id
      JOIN modules m ON m.id = l.module_id
      JOIN courses c ON c.id = m.course_id
      WHERE ea.id = external_assessment_sessions.external_assessment_id AND c.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Instructors update course assessment sessions" ON external_assessment_sessions;
CREATE POLICY "Instructors update course assessment sessions" ON external_assessment_sessions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM external_assessments ea
      JOIN content_items ci ON ci.id = ea.content_item_id
      JOIN lessons l ON l.id = ci.lesson_id
      JOIN modules m ON m.id = l.module_id
      JOIN courses c ON c.id = m.course_id
      WHERE ea.id = external_assessment_sessions.external_assessment_id AND c.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Assessment responses follow session access" ON external_assessment_responses;
CREATE POLICY "Assessment responses follow session access" ON external_assessment_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM external_assessment_sessions s
      JOIN enrollments e ON e.id = s.enrollment_id
      WHERE s.id = external_assessment_responses.session_id AND e.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM external_assessment_sessions s
      JOIN external_assessments ea ON ea.id = s.external_assessment_id
      JOIN content_items ci ON ci.id = ea.content_item_id
      JOIN lessons l ON l.id = ci.lesson_id
      JOIN modules m ON m.id = l.module_id
      JOIN courses c ON c.id = m.course_id
      WHERE s.id = external_assessment_responses.session_id AND c.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Instructors grade assessment responses" ON external_assessment_responses;
CREATE POLICY "Instructors grade assessment responses" ON external_assessment_responses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM external_assessment_sessions s
      JOIN external_assessments ea ON ea.id = s.external_assessment_id
      JOIN content_items ci ON ci.id = ea.content_item_id
      JOIN lessons l ON l.id = ci.lesson_id
      JOIN modules m ON m.id = l.module_id
      JOIN courses c ON c.id = m.course_id
      WHERE s.id = external_assessment_responses.session_id AND c.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "No client access to webhook events" ON webhook_assessment_events;
CREATE POLICY "No client access to webhook events" ON webhook_assessment_events
  FOR ALL USING (false);

DROP TRIGGER IF EXISTS update_external_assessments_updated_at ON external_assessments;
CREATE TRIGGER update_external_assessments_updated_at BEFORE UPDATE ON external_assessments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_external_assessment_sessions_updated_at ON external_assessment_sessions;
CREATE TRIGGER update_external_assessment_sessions_updated_at BEFORE UPDATE ON external_assessment_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- === Publish snapshot columns ===
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS published_snapshot JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS has_unpublished_changes BOOLEAN DEFAULT FALSE;
