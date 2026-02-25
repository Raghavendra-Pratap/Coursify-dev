-- Add duration_seconds to lessons if missing (fixes "Could not find the 'duration_seconds' column" error)
-- Run this in Supabase SQL Editor: Dashboard → SQL Editor → New query → paste → Run

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lessons' AND column_name = 'duration_seconds'
  ) THEN
    ALTER TABLE lessons ADD COLUMN duration_seconds INTEGER DEFAULT 0;
    RAISE NOTICE 'Added duration_seconds to lessons';
  ELSE
    RAISE NOTICE 'lessons.duration_seconds already exists';
  END IF;
END $$;
