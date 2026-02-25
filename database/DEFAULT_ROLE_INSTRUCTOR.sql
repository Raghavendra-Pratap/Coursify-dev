-- New signups = instructor by default. Run in Supabase SQL Editor.
-- When a user signs up via a course invite link, set their role to 'learner' in the app (invite flow).
ALTER TABLE public.user_profiles
  ALTER COLUMN role SET DEFAULT 'instructor';
