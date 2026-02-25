## Learned User Preferences

- Touch the fewest files possible; no refactors unless required.
- Add TODO comments for uncertain logic; do not optimize prematurely.
- Implement real features instead of placeholder values or options.
- Keep cost low; target free tier for expected user base under 1000.
- Use Supabase for Auth and Database only; do not use Supabase for content storage (videos in Google Drive, YouTube, or external URLs).
- Use a unified video link box that accepts YouTube, Google Drive, or any public video URL.
- Accept timestamps only in HH:MM:SS; start must not be less than 00:00:00; end must not exceed optional video max duration.
- Enforce segment playback so learners cannot access video beyond the allowed segment or timestamp.
- Maintain AGENTS.md memory (continual learning) using transcript deltas; keep only Learned User Preferences and Learned Workspace Facts sections.

## Learned Workspace Facts

- Coursify LMS: micro-video management; hierarchy is courses → modules (order_index) → lessons (order_index) → content items (video, quiz, form, reading).
- Main app entry: app/page.tsx → CoursifyLMS; shell and routing in components/CoursifyLMS.tsx.
- Course authoring and structure: components/pages/CreateCourse.tsx (large file; use targeted search e.g. parseHHMMSSToSeconds, handleSave, videoSegment then small edits).
- Course list and other pages: MyCourses.tsx, Learners.tsx, Analytics.tsx, Reports.tsx; Supabase client in lib/supabase.ts; schema in database/schema.sql (run in Supabase SQL Editor).
- video_segments source CHECK includes upload, google_drive, youtube, external_url; learner_preferences and learner_activity tables exist for the self-learning preference loop.
- Env: .env.local from env.template; NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY required; .env*.local gitignored.
- Module names are editable (click title in sidebar); sequence numbers use order (1. Title, 2. Title) and auto-update on drag-and-drop reorder.
- Google Drive integration section in CreateCourse is commented out; reading materials content type exists (link or native text; not yet persisted to DB).
- Preference loop: lib/preference-loop.ts, lib/use-preference-loop.ts; Settings shows Learning preferences; record activity and use preferences for recommendations (docs/PREFERENCE_LOOP.md).
- Root components/ and coursify-app/ can differ; prefer root for instructor flows; coursify-app for learner-specific when referenced. Exclude coursify-app from root tsconfig if root build type-checks it.
- After schema changes run relevant SQL in Supabase; update RLS and indexes as needed.
