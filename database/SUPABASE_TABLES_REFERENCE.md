# Supabase tables reference

## What you have vs what the app expects

You currently have (in `public`):  
`course_analytics`, `course_templates`, `courses`, `enrollments`, `google_drive_connections`, `learner_activity`, `learner_preferences`, `lessons`, `modules`, `progress`, `user_profiles`, `video_segments`.

The Coursify app also expects these **missing** tables:

| Table | Purpose |
|-------|--------|
| **content_items** | Links lessons to blocks of content (video / quiz / form). Required: flow is **lesson → content_items → video_segments** (or quizzes/forms). |
| **quizzes** | Quiz content (one per quiz content item). |
| **quiz_questions** | Questions for each quiz. |
| **forms** | Form content (one per form content item). |
| **form_fields** | Fields for each form. |
| **course_versions** | Optional; course version history / snapshots. |
| **quiz_attempts** | Learner quiz submissions and scores. |
| **learner_invites** | Invite-by-email (Learners page). |
| **learner_reminders** | Persisted “send reminder” (Learners page). |

## What to run in Supabase

1. **Add the missing tables**  
   In Supabase **SQL Editor**, run:  
   **`database/MIGRATE_MISSING_TABLES.sql`**

2. **video_segments and content_items**  
   The app assumes: **lesson → content_items → video_segments** (each segment has `content_item_id`).  
   - If your `video_segments` already has **content_item_id** and you were only missing `content_items`, creating `content_items` (step 1) is enough.  
   - If your `video_segments` was created with **lesson_id** instead of **content_item_id**, it doesn’t match the app. Then either:  
     - Change the app to use `lesson_id` for video_segments, or  
     - Align the DB with the main schema: add `content_items`, then migrate `video_segments` to use `content_item_id` (see full `database/schema.sql` for the expected `video_segments` definition).

## Optional / not in main app

- **course_templates** – You have it; the root app doesn’t use it. The coursify-app may use it. No change needed.

You don’t need any other tables beyond the ones in the full `database/schema.sql` (or the migration above) for the current app.
