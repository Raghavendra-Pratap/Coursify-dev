# Q & A sidebar and threads – setup

The **Q & A** sidebar item and thread UI are implemented. API routes and thread support in the course questions route are in place.

## 1. Database: add thread support (required once)

If the `course_questions` table does not yet have a `parent_id` column, run in **Supabase SQL Editor**:

```sql
-- File: database/ADD_COURSE_QUESTIONS_PARENT_ID.sql
ALTER TABLE course_questions
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES course_questions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_course_questions_parent_id ON course_questions(parent_id);
```

## 2. API (done)

- **`app/api/learning/courses/[courseId]/questions/route.ts`** – GET returns threads (roots + `followUps`); POST accepts optional `parent_id` for follow-up questions.
- **`app/api/learning/my-questions/route.ts`** – GET returns `{ threads }` for the current learner.
- **`app/api/instructor/questions/route.ts`** – GET returns `{ threads }` for courses the user owns or collaborates on.

## 3. Frontend (done)

- **Sidebar:** “Q & A” nav item added for both learner and instructor (view `qa`).
- **Page:** `components/pages/QAndA.tsx` – lists threads, expand/collapse, follow-up (learner), answer (instructor), “Open course” link.

After running the migration in step 1 (if `parent_id` is not already on `course_questions`), the Q & A sidebar will show all questions/threads and allow follow-ups and answers.
