# Self-Learning Preference Loop

The preference loop infers each learner’s preferences from their activity and uses them to improve ordering and recommendations.

## Loop

1. **Record activity** – When a learner completes, views, or skips content, call `recordActivity(userId, { content_type, entity_type, entity_id, action, time_spent_seconds })`.
2. **Update preferences** – `recordActivity` triggers `updatePreferencesFromActivity(userId)`, which:
   - Reads recent activity (last 30 days)
   - Increases weights for content types they complete often and decreases for types they skip
   - Writes updated weights to `learner_preferences`
3. **Use preferences** – Use `getPreferences(userId)` and `getContentRecommendationScore(contentType, preferences)` or `getCourseRecommendationScore(contentMix, preferences)` to order content or show “Recommended for you”.

## Database

- **learner_preferences** – One row per user: `content_video_weight`, `content_reading_weight`, `content_quiz_weight`, `pace_score`, `updated_at`.
- **learner_activity** – One row per event: `user_id`, `content_type` (video | reading | quiz | form), `entity_type`, `entity_id`, `action` (completed | viewed | skipped | started), `time_spent_seconds`, `created_at`.

Run the migrations in `database/schema.sql` (tables and RLS for `learner_preferences` and `learner_activity`) so the loop can persist.

## Where to record activity

- **Lesson completed** – When you mark a lesson complete (e.g. in a learner view or progress API), determine the lesson’s primary content type (from `content_items` for that lesson), then:
  ```ts
  import { recordActivity } from '@/lib/preference-loop';
  await recordActivity(userId, {
    user_id: userId,
    content_type: 'video', // or 'reading' | 'quiz' | 'form'
    entity_type: 'lesson',
    entity_id: lessonId,
    action: 'completed',
    time_spent_seconds: timeSpent,
  });
  ```
- **Content viewed / skipped** – Same pattern with `action: 'viewed'` or `'skipped'`.

## Where to use preferences

- **Settings** – `LearningPreferences` shows current weights and lets users simulate activity to see the loop.
- **Learner view** – Order lessons or content items by `getContentRecommendationScore(type, preferences)` so preferred types appear first.
- **My Courses** – "Recommended for you" sort uses `getCourseRecommendationScore(contentMix, preferences)`; content mix from `content_items` per course. **Recording:** In coursify-app learner view, completing a lesson records activity and updates preferences. Use `getCourseRecommendationScore(contentMix, preferences)` to sort or tag “Recommended for you”.

## API (lib/preference-loop.ts)

| Function | Purpose |
|----------|---------|
| `getPreferences(userId)` | Get current preferences (or defaults). |
| `recordActivity(userId, row)` | Insert one activity row and run the update step. |
| `updatePreferencesFromActivity(userId)` | Recompute preferences from recent activity. |
| `getContentRecommendationScore(contentType, preferences)` | Score 0–1 for a content type. |
| `getCourseRecommendationScore(contentMix, preferences)` | Score 0–1 for a course given its video/reading/quiz mix. |

## Hook (lib/use-preference-loop.ts)

`usePreferenceLoop(userId)` returns:

- `preferences` – Current preferences or null.
- `loading` – True while loading.
- `recordActivity(row)` – Record and refresh preferences.
- `refresh()` – Re-fetch preferences.
