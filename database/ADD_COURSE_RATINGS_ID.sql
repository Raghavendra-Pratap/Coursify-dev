-- Ensure course_ratings has an id column for API/UI compatibility.
-- Safe for existing tables that already use (user_id, course_id) uniqueness.

CREATE TABLE IF NOT EXISTS course_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, course_id)
);

ALTER TABLE course_ratings
  ADD COLUMN IF NOT EXISTS id UUID;

ALTER TABLE course_ratings
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

UPDATE course_ratings
SET id = gen_random_uuid()
WHERE id IS NULL;

-- Keep uniqueness used by upsert(onConflict: user_id,course_id).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'course_ratings_user_id_course_id_key'
  ) THEN
    ALTER TABLE course_ratings
      ADD CONSTRAINT course_ratings_user_id_course_id_key UNIQUE (user_id, course_id);
  END IF;
END $$;

-- Add a primary key on id only when table has no primary key yet.
DO $$
DECLARE
  has_pk BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'course_ratings'
      AND c.contype = 'p'
  ) INTO has_pk;

  IF NOT has_pk THEN
    ALTER TABLE course_ratings
      ADD CONSTRAINT course_ratings_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- If a different primary key already exists, keep it and ensure id stays unique.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'course_ratings_id_key'
  ) THEN
    ALTER TABLE course_ratings
      ADD CONSTRAINT course_ratings_id_key UNIQUE (id);
  END IF;
END $$;
