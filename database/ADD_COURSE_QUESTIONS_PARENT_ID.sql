-- Add thread support: follow-up questions link to parent question
-- Run in Supabase SQL Editor after course_questions table exists.

ALTER TABLE course_questions
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES course_questions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_course_questions_parent_id ON course_questions(parent_id);

COMMENT ON COLUMN course_questions.parent_id IS 'When set, this row is a follow-up to the parent question (same thread).';
