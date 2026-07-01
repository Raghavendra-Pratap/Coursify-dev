-- Course programs (named groups of courses for bulk invite).
-- Run in Supabase SQL Editor after schema.sql.

CREATE TABLE IF NOT EXISTS course_programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS course_program_members (
  program_id UUID NOT NULL REFERENCES course_programs(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (program_id, course_id),
  UNIQUE (program_id, order_index)
);

CREATE INDEX IF NOT EXISTS idx_course_programs_created_by ON course_programs(created_by);
CREATE INDEX IF NOT EXISTS idx_course_program_members_course_id ON course_program_members(course_id);

ALTER TABLE learner_invites
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES course_programs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_learner_invites_program_id ON learner_invites(program_id);

ALTER TABLE course_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_program_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own course programs" ON course_programs
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can insert own course programs" ON course_programs
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own course programs" ON course_programs
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own course programs" ON course_programs
  FOR DELETE USING (auth.uid() = created_by);

CREATE POLICY "Users can view members of own programs" ON course_program_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM course_programs p
      WHERE p.id = course_program_members.program_id AND p.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert members of own programs" ON course_program_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM course_programs p
      WHERE p.id = course_program_members.program_id AND p.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete members of own programs" ON course_program_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM course_programs p
      WHERE p.id = course_program_members.program_id AND p.created_by = auth.uid()
    )
  );

CREATE TRIGGER update_course_programs_updated_at
  BEFORE UPDATE ON course_programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
