# Version History and Delete (Lessons & Modules)

## Version history

- **Where:** Course edit page → **Version History** section (below the main content area).
- **When:** Each time you click **Save**, a new version is stored in the `course_versions` table.
- **What’s stored:** Version number, short description (e.g. “Saved: X module(s), Y lesson(s)”), timestamp, and a **course snapshot** (title, description, and full module/lesson/content structure).
- **Restore:** Use **Restore** on a past version to load that snapshot back into the editor. The restored state becomes the current draft; save again to persist it.
- **Database:** Requires the `course_versions` table (see `database/schema.sql` or `database/MIGRATE_MISSING_TABLES.sql`). If the table or RLS is missing, save still works but versions are not recorded.

## Delete module / lesson

- **Module:** In the **Course Structure** sidebar, each module row has a **trash** icon. Click it to remove that module and all its lessons from the course. The editor selection moves to another module if needed.
- **Lesson:** Each lesson row in the sidebar has a **trash** icon. Click it to remove that lesson (and its content items) from the module. Selection updates so the editor stays valid.
- **Persistence:** Deletes only change the current draft. Click **Save** to persist; the save flow replaces all modules/lessons for that course in the database.

## Avoiding duplicate modules

- For an **existing** course, save calls the **structure API** (`POST /api/instructor/courses/[courseId]/structure`), which replaces the full course structure server-side (delete all modules then insert current structure), so RLS cannot block the delete and module/lesson counts stay correct.
- If you still see many “Module 1” entries, either:
  - RLS may be blocking the delete (check Supabase policies for `modules` / `lessons`), or
  - The course was saved multiple times as a **new** course instead of editing the same one.
- Use the **delete** icons to remove duplicate modules (or lessons) in the editor, then **Save** once. After saving, refresh the Take Course page so the sidebar and lesson count update.
