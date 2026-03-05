# Version History and Publish — How It Works

This doc answers: how we use Version History, where it’s saved, whether it can be restored, and how **Edit/Save** vs **Publish** work.

---

## 1. How we use Version History

- **Where it appears:** Create Course page → **Version History** section (below the main editor, “Show All Versions” to expand).
- **What it is:** A list of **saved snapshots** of the course. Each row shows version number, short description (e.g. “Saved: 2 module(s), 5 lesson(s)”), timestamp, and **Restore** for past versions.
- **When a version is created:** A new version is created **only when the course content has changed**. If you click **Save** and the structure (title, description, modules/lessons/content) is the same as the latest saved version, no new version row is created—the live DB is still updated, but the version history list stays unchanged. When there are changes, the current editor state is stored as a **new** version and marked **current**; previous versions stay as-is.
- **Current version:** The version marked `is_current: true` in the DB is only used for display in the UI (“Current” badge). The **live** content learners see always comes from the **live tables** (see below), not from “current” version.

So: Version History is **history of what was saved**, not a separate “published” copy. It’s used to **restore** a past state into the editor and optionally save it again.

---

## 2. Where we save it

| What | Where |
|------|--------|
| **Version metadata + snapshot** | Table **`course_versions`** in Supabase |
| **Live course content (what learners see)** | Tables **`courses`**, **`modules`**, **`lessons`**, **`content_items`**, **`video_segments`**, **`quizzes`**, **`forms`**, **`reading_materials`** (etc.) |

### Table `course_versions`

- **Columns:** `id`, `course_id`, `version_number`, `changes_description`, `created_by`, `created_at`, `is_current`, **`course_snapshot`** (JSONB).
- **`course_snapshot`** = full copy of at-save state: `{ title, description, modules }`. Each module has lessons; each lesson has content items (video/quiz/form/reading with segment details). So we store the **entire course structure** at that moment.
- **When we write:** On **Save**, we compare the current editor state to the latest version’s `course_snapshot` (normalized for comparison, ignoring ids and volatile fields like `lastEdited`). **Only if they differ** do we insert one new row into `course_versions` (next `version_number`, `is_current: true`) and set all other rows for that course to `is_current: false`. If there are no changes, the save still updates the live tables but no new version is created.
- **Schema:** See `database/schema.sql` or `database/MIGRATE_MISSING_TABLES.sql`. If `course_versions` or RLS is missing, Save still works but no version row is created (code catches the error and continues).

So: **Version history is saved only in `course_versions`**. The **live** content is saved in the normal course/module/lesson/content tables (via the structure API or initial insert when creating a new course).

---

## 3. Can it be restored?

**Yes.**

- **Restore** (button on a past version in the Version History list):
  1. Loads that version’s **`course_snapshot`** from `course_versions`.
  2. Puts that snapshot into the **editor state** (title, description, modules/lessons/content).
  3. Updates `course_versions`: the restored version is set to `is_current: true`, all others for that course to `is_current: false`.
  4. **Does not** write to `modules` / `lessons` / `content_items`. So the **live** course (what learners see) is **unchanged** until you click **Save** again.

So: **Restore = load a past snapshot into the editor.** To make that state the live one, you must click **Save** after restoring. After Save, the live tables and the “current” version both reflect the restored content.

---

## 4. Edit / update vs Publish

### Edit and update (draft)

- **Edit:** You change the course in the Create Course UI (add/remove/reorder modules, lessons, content; edit titles, video segments, etc.). That’s all in-memory / editor state until you save.
- **Save:**
  - **Existing course:** Calls **`POST /api/instructor/courses/[courseId]/structure`** with the current editor state. That API **replaces** the full structure: deletes all modules for that course, then inserts the current modules/lessons/content (so the live DB matches the editor).
  - **New course:** Inserts into `courses`, then inserts modules, lessons, content items, video_segments, quizzes, forms, etc.
  - After writing the live structure, we **insert a new row** in `course_versions` with the same structure as a snapshot and set it as current.
- So: **every Save updates the live content** that learners see (and creates a new version in history). There is no separate “draft DB” — the only draft is the **editor state** before you click Save.

### Publish

- **What it does:** **Publish** only updates the **`courses.status`** field to `'published'` for that course. It does **not** copy a version or change modules/lessons/content.
- **Effect:** Learners typically see courses that are `status = 'published'`. So:
  - **Draft** = `status = 'draft'` → course exists and is editable; may be hidden from learners or shown only to instructors.
  - **Published** = `status = 'published'` → course is “live” for learners (depending on how your app filters course lists).
- **Who can publish:** In the current code, any signed-in user who can edit the course can click Publish (no separate role check in the UI). You can add RLS or API checks so only admin/instructor can set `status = 'published'`.

### Summary flow

| Action | Effect |
|--------|--------|
| **Edit in UI** | Changes only in editor (in-memory). |
| **Save** | Writes current editor state to **live tables** (structure API or insert) and adds a **new version** in `course_versions`. Learners see this content. |
| **Restore (version)** | Loads a past snapshot into the **editor** and marks that version “current” in `course_versions`. Live tables unchanged until you **Save** again. |
| **Publish** | Sets `courses.status = 'published'`. Content is already whatever was last **Saved**; Publish only flips visibility for learners. |

So: **Edit** → **Save** = update content and create a version. **Restore** → **Save** = make a past snapshot the new live content. **Publish** = mark the course as published (no separate “published version” table).

---

## 5. Optional: “Draft vs published version” (future)

Right now there is **no** “published version” separate from the live tables. If you want a Git-like flow later:

- **Draft:** Edits go to the editor; **Save** could write to a “draft” copy (e.g. same tables with a flag, or a separate draft structure).
- **Publish:** Would copy the “draft” (or a chosen version) into the “live” structure that learners read, and only certain roles could run Publish.

That would require schema/API changes and is not implemented today. Today, **Save** is the only write to the live structure, and **Publish** only toggles `courses.status`.
