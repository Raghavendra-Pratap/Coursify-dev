# Editor vs Publisher Roles, Draft vs Published Content, and Ownership Transfer

This document describes the **one-exchange** model:

- **Editors (collaborators)** can edit and save the course; the course is **not** available to learners until it is **published**.
- **Admin** and **Instructor (course owner)** are the only ones who can **publish** (and republish) a course.
- Learners always see the **last published** version until a new version is published; editors’ saves only update the draft.

It also covers **transfer of ownership** and how to show courses that need republishing.

---

## 1. Roles and permissions

| Role | Who | Can edit & save | Can publish | Can add/remove collaborators | Can delete course | Can transfer ownership |
|------|-----|-----------------|-------------|------------------------------|-------------------|-------------------------|
| **Admin** | `user_profiles.role = 'admin'` | Yes (all courses) | Yes (all courses) | No (unless owner) | No (unless owner) | No (unless owner) |
| **Instructor (owner)** | `courses.created_by = user_id` | Yes | Yes | Yes | Yes | Yes |
| **Editor (collaborator)** | In `course_collaborators` for that course | Yes | **No** | No | No | No |

- **Editors** = users in `course_collaborators` for that course. They can open the course, change content, and **Save**. Saving only updates the **draft** (live tables). It does **not** change what learners see.
- **Publish** (and **Republish**) is allowed only for:
  - The **course owner** (`courses.created_by`), or
  - An **admin** (`user_profiles.role = 'admin'`).

So: collaborators can edit and save; only owner or admin can publish.

---

## 2. Draft vs published content

Today, **Save** writes directly to the live tables (modules, lessons, content_items, etc.), and learners read from those same tables. So after a save, learners would see the new content immediately if the course is published.

To support “editors can save but learners see only published version” we introduce a **published snapshot**:

- **Draft** = current content in the live tables (modules, lessons, content_items, video_segments, quizzes, forms, reading_materials). This is what the editor sees and what **Save** updates.
- **Published** = a frozen copy of the course structure stored when someone clicks **Publish** or **Republish**. Learners **always** read from this copy until the next publish.

### Schema (add to `courses`)

- **`published_snapshot`** (JSONB, nullable)  
  Full course structure at last publish: `{ title, description, modules }` with the same shape as `course_versions.course_snapshot` (modules → lessons → content with video/quiz/form/reading details).  
  When `NULL`, treat as “never published” (learners don’t see the course until first publish, or use a legacy path if you prefer).

- **`published_at`** (TIMESTAMPTZ, nullable)  
  Set when the course was last published. Useful for “Last published on …” and for sorting.

- **`has_unpublished_changes`** (BOOLEAN, default `false`)  
  Set to `true` whenever **Save** is called and the course is already published (`status = 'published'`). Set to `false` when **Publish** or **Republish** runs.  
  Used to show “To republish” and “Unpublished changes” in the UI.

### Save (editors and owners)

- **Save** continues to update only the **live** tables (via existing structure API or direct inserts/updates).
- **Do not** update `published_snapshot` on Save.
- If the course is currently **published** (`status = 'published'`), set `courses.has_unpublished_changes = true` when Save succeeds.
- Optionally, when creating a **new** course, keep `published_snapshot = NULL` and `status = 'draft'` until first Publish.

So: editors (and owners) can save as often as they want; learners keep seeing the last published snapshot until someone publishes again.

### Publish / Republish (owner or admin only)

- **Who can call Publish:** Only if the current user is the **course owner** (`courses.created_by = auth.uid()`) or an **admin** (`user_profiles.role = 'admin'`). Enforce in API and optionally in UI (e.g. hide or disable Publish for collaborators).
- **What Publish does:**
  1. Build the current course structure from the **live** tables (same data the editor sees after Save), in the same format as `course_versions.course_snapshot`.
  2. Set `courses.published_snapshot = <that JSON>`.
  3. Set `courses.published_at = NOW()`.
  4. Set `courses.has_unpublished_changes = false`.
  5. Set `courses.status = 'published'` (if not already).
- **Republish** = same operation when the course is already published; it just overwrites `published_snapshot` with the current draft and clears `has_unpublished_changes`.

Learners then read from `published_snapshot` when it is present (see below).

---

## 3. How learners see the course

- For a **published** course (`status = 'published'`), the **learner-facing API** (e.g. “get course content for this course”) should:
  - If `courses.published_snapshot` is not null, return the structure from **`published_snapshot`** (title, description, modules with lessons and content). All learner-facing reads (course outline, lesson content, video segments, quizzes, forms, reading) should be derived from this snapshot so that learners see a consistent, immutable version until the next publish.
  - If `published_snapshot` is null (e.g. legacy course or first publish not yet done), fall back to reading from the live tables so existing behavior is preserved.
- **Progress, enrollments, analytics** continue to use the same tables (e.g. by course_id and, where needed, stable identifiers inside the snapshot). You may need to map snapshot content (e.g. lesson “keys” or order) to progress records if they are stored by lesson_id; one approach is to store in the snapshot stable keys (e.g. module index + lesson index) and keep a mapping or accept that progress is per course and per “slot” derived from the snapshot.

This way, until the course is republished, learners always see the old version even if editors have saved many times.

---

## 4. Showing “courses to republish”

- **“To republish”** = courses where the current user can publish (owner or admin) and **`status = 'published'`** and **`has_unpublished_changes = true`**.
- In **My Courses** (or a dedicated “To republish” section), list these courses and optionally show a badge like “Unpublished changes” or “Republish to release latest”.
- In **Create Course**, when editing a published course with unpublished changes, show a notice: “You have unpublished changes. Only the course owner or an admin can publish to release this version to learners.”

---

## 5. UI summary

- **Save**  
  - Visible to: anyone who can edit (owner, collaborator, admin).  
  - Action: updates draft (live tables); if course is published, set `has_unpublished_changes = true`.

- **Publish / Republish**  
  - Visible to: **only course owner or admin.**  
  - For collaborators: hide the Publish button, or show it disabled with tooltip: “Only the course owner or an admin can publish.”  
  - Action: copy current draft → `published_snapshot`, set `published_at`, clear `has_unpublished_changes`, set `status = 'published'`.

- **My Courses**  
  - Include `created_by`, `has_unpublished_changes`, and optionally `published_at` in the course list for the current user.  
  - Show “Unpublished changes” (or “To republish”) for published courses with `has_unpublished_changes = true` when the user is owner or admin.

---

## 6. Transfer of ownership

- **Who can transfer:** Only the **course owner** (`courses.created_by = auth.uid()`). Admins could be allowed in a future step (e.g. “reassign owner” in admin UI).
- **What it does:**  
  - Change **`courses.created_by`** to the new owner’s user id.  
  - Optionally add the **previous owner** to **`course_collaborators`** so they keep edit access but lose publish/delete/transfer rights.  
  - Optionally send an email or in-app notification to the new owner.
- **How to implement:**  
  - **UI:** In course settings or Collaborators modal, add “Transfer ownership” (only visible to owner). Owner enters the new owner’s email; backend looks up user by email and checks they exist (and optionally that they are instructor/admin).  
  - **API:** e.g. `POST /api/instructor/courses/[courseId]/transfer-ownership` with body `{ "newOwnerEmail": "..." }`. The API checks that the caller is the current owner, then updates `courses.created_by` and optionally inserts the old owner into `course_collaborators`.  
  - **RLS:** After transfer, the new owner is the only one who can delete, add/remove collaborators, and transfer again; the old owner (if added as collaborator) can only edit and save.

---

## 7. Implementation checklist

- [x] **DB migration:** Add to `courses`: `published_snapshot` (JSONB), `published_at` (TIMESTAMPTZ), `has_unpublished_changes` (BOOLEAN default false). See `database/DRAFT_PUBLISHED_SNAPSHOT.sql`.
- [ ] **Structure API (Save):** When updating an existing course and `status = 'published'`, set `has_unpublished_changes = true`. Do not write to `published_snapshot` on Save.
- [ ] **Publish API:** New or existing endpoint that: (1) checks caller is owner or admin; (2) builds current structure from live tables; (3) updates `courses` with `published_snapshot`, `published_at`, `has_unpublished_changes = false`, `status = 'published'`.
- [ ] **Learner content API:** For published courses, if `published_snapshot` is present, return content from it; else fall back to live tables.
- [x] **Create Course UI:** Load `created_by` and current user’s role; compute `canPublish = (course.created_by === userId) || (role === 'admin')`; show Publish only when `canPublish`; show tooltip for collaborators.
- [x] **My Courses:** Fetch `created_by`, `has_unpublished_changes` (and `published_at`); show “To republish” / “Unpublished changes” for published courses where user can publish and `has_unpublished_changes = true`.
- [ ] **Transfer ownership:** Add “Transfer ownership” in UI (owner only); add API and RLS so only owner can call it; update `created_by` and optionally add old owner as collaborator.

---

## 8. Summary table

| Action | Who | Effect |
|--------|-----|--------|
| **Save** | Owner, collaborator, admin | Updates **draft** (live tables). If course is published, sets `has_unpublished_changes = true`. Learners unchanged. |
| **Publish / Republish** | Owner or admin only | Copies draft → `published_snapshot`, sets `published_at`, `has_unpublished_changes = false`, `status = 'published'`. Learners see this version. |
| **Transfer ownership** | Owner only | Sets `courses.created_by` to new owner; optionally add old owner as collaborator. |

This gives you: editors can edit and save; course stays in draft for learners until owner or admin publishes; learners always see the last published version until republish; and a clear path to transfer ownership.
