-- Run in Supabase SQL Editor to persist learner notes across devices.

CREATE TABLE IF NOT EXISTS learner_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  course_title TEXT NOT NULL DEFAULT '',
  lesson_title TEXT NOT NULL DEFAULT '',
  module_id UUID REFERENCES modules(id) ON DELETE SET NULL,
  module_title TEXT,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, course_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_learner_notes_user_id ON learner_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_learner_notes_course_id ON learner_notes(course_id);
CREATE INDEX IF NOT EXISTS idx_learner_notes_updated_at ON learner_notes(updated_at DESC);

ALTER TABLE learner_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own learner notes" ON learner_notes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own learner notes" ON learner_notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own learner notes" ON learner_notes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own learner notes" ON learner_notes
  FOR DELETE USING (auth.uid() = user_id);
