# Feature Roadmap — This Session

**Branch:** `feature/development`  
**Last updated:** 2025-02-11

This doc organizes your feature list, adds brief context from the codebase, and suggests an order so we can pick one by one or batch sensibly.

---

## Instructor Mode

### 1. Fix slider & video sync
**What:** Timeline/slider in the course editor and/or learner player doesn’t stay in sync with playback (or vice versa).  
**Current state:** `LessonVideoPlayer.tsx` already polls YouTube `getCurrentTime` (100ms) and syncs HTML5 video via `timeupdate`; CreateCourse has segment preview players (YouTube, Drive, iframe).  
**Thoughts:** Need the exact bug (e.g. “slider in CreateCourse doesn’t move” vs “TakeCourse slider jumps”). Likely small scope — good **first pick** to fix and build momentum.

---

### 2. Quiz mode
**What:** Full quiz flow in the product (add quiz in editor, take quiz in Take Course, optional score recording).  
**Current state:** Quiz is **implemented but hidden** in CreateCourse (Add Quiz button not shown). Google Form–based; webhook for scores; token-based security. See `docs/ADD_QUIZ_FEATURE_AND_IMPLEMENTATION.md`.  
**Thoughts:** Re-enable UI + smoke-test is **quick**. New quiz engine (non–Google Form) would be a **larger** project. Recommend: **enable existing quiz** first, then iterate.

---

### 3. Segment sequencing — change in layout
**What:** Change how segments are ordered or displayed (e.g. timeline vs list, lock order, prerequisites).  
**Current state:** CreateCourse: modules → lessons → content items (video/quiz/form/reading); drag-and-drop reorder. TakeCourse: linear step order from content items.  
**Thoughts:** “Layout change” could mean: (a) **editor UI** (e.g. horizontal segment strip, timeline), or (b) **learner UI** (e.g. non-linear paths). Clarifying which screen and what change will set scope. **Medium** effort once defined.

---

### 4. How versioning works + Git-like / GitHub-style + roles
**What:**
- Clear versioning model (when versions are created, what’s stored, how restore works).
- “Git-type” or “GitHub-type” workflow: e.g. **Editor** edits & saves (draft); **Admin/Instructor** can **publish** (version becomes live).

**Current state:** See `docs/VERSION_HISTORY_AND_DELETE.md`. On **Save**, a snapshot goes to `course_versions` (version #, description, full structure). **Restore** loads a past version into the editor; save again to persist. No separate “draft vs published” or role-gated publish today — save writes the course structure.  
**Thoughts:**
- **Document** current behavior in a short “How versioning works” (for product/support) — **quick**.
- **Git-like workflow:** Introduce **draft** (editable) vs **published** (what learners see). Only certain roles can “Publish”; editors can only “Save draft”. DB/API: e.g. `courses.published_version_id` or `courses.published_at` + version snapshot. **Larger** feature — schema + APIs + UI.
- **GitHub-style** (branches, PRs, review) is a bigger product/UX decision; can be a later phase after draft/publish exists.

**Recommendation:** Start with **documenting current versioning** and a **short design** for “draft vs published + who can publish”. Then implement draft/publish in one slice (e.g. “Publish” button + RLS/API for role).

---

### 5. Bulk upload — sheet or folder “fetch on context”
**What:** Create many lessons/segments at once: e.g. upload a **spreadsheet** (CSV/Sheet) or point at a **folder** (e.g. Google Drive folder) and have the app create structure from it (e.g. one row per lesson, or one file per segment).  
**Current state:** CreateCourse supports single-file/link upload and manual drag-and-drop; no bulk import.  
**Thoughts:** High value for power users. Scope depends on format: (a) **CSV/Sheet** with columns (e.g. module, lesson, title, video URL) → parse and create modules/lessons/contents; (b) **Drive folder** → list files, map to lessons/segments (and optionally fetch metadata). **Medium–large**; good candidate after slider fix and quiz enable.

---

## Learner Mode

### 6. Notes section (Take Course + in slider)
**What:** Learners can take **notes** while taking a course — per lesson or per segment; visible in Take Course and/or in the slider (e.g. timeline with note markers).  
**Current state:** TakeCourse has video, reading, quiz/form; no notes.  
**Thoughts:** Requires: **storage** (e.g. `learner_notes` table: user, course, lesson/content, text, timestamp?), **UI** (notes panel or inline, sync with current segment). **Medium**; improves engagement and is a strong differentiator.

---

### 7. Discussion
**What:** Discussion threads per course or per lesson (e.g. forum-style).  
**Current state:** None.  
**Thoughts:** Needs: **data model** (e.g. threads, posts, links to course/lesson), **UI** (list threads, view thread, reply), **notifications** if you want “new reply” alerts. **Medium–large**; often paired with “Raise a question” (below).

---

### 8. Raise a question (in Take Course)
**What:** From a lesson/segment, learner can “raise a question” (to instructor or to discussion).  
**Current state:** None.  
**Thoughts:** Can start **lightweight**: e.g. “Ask a question” → form (question text, optional segment timestamp) → stored as **support request** or **discussion post**. Ties into **Discussion** and **Notifications**. **Medium**; can be Phase 1 (simple form + list for instructor) then Phase 2 (full discussion).

---

### 9. Notifications (course updates, certification, etc.)
**What:** Notify learners (and/or instructors): e.g. course updated, certificate awarded, new comment on discussion, reply to “raised question”.  
**Current state:** None.  
**Thoughts:** Requires: **notification channel** (in-app only vs email vs both), **preferences**, **data** (e.g. `notifications` table + triggers or job). Start with **in-app only** (bell + list) to keep scope manageable; add email later. **Medium**; unblocks “course updated” and “certification” messaging and pairs with discussion/notes.

---

### 10. Feedback loop — comments and stars
**What:** Learners can rate (e.g. stars) and/or comment on a course or lesson (feedback for instructor).  
**Current state:** None.  
**Thoughts:** Straightforward: **ratings** (e.g. 1–5) and **comments** per course (or per lesson); store in DB; show in instructor Analytics or course dashboard. **Small–medium**; high signal for L&D.

---

## Optional

### 11. Course thumbnail generator
**What:** Auto-generate or suggest a course thumbnail (e.g. from first frame of first video, or from a template with course title).  
**Current state:** Course likely has a thumbnail URL field; manual paste/upload.  
**Thoughts:** **Quick win:** “Generate from first video” (frame at 0 or first segment) or “Pick frame” from a segment. **Fancy:** AI-generated image from title/description — optional later. **Small** for “frame picker”; **medium** if you add image generation.

---

## Suggested order (pick one by one or in batches)

| Priority | Item | Why |
|----------|------|-----|
| 1 | **Fix slider & video sync** | Small, unblocks good UX; need exact bug description. |
| 2 | **Quiz mode (enable existing)** | Logic exists; show Add Quiz, test flow. Fast win. |
| 3 | **Versioning: document + draft/publish design** | Document first; then one slice: “Publish” + role check. |
| 4 | **Notes (Take Course + slider)** | High learner value; clear scope. |
| 5 | **Feedback (comments + stars)** | Small–medium; high value for instructors. |
| 6 | **Bulk upload (sheet or folder)** | Big time-saver; after core editor is solid. |
| 7 | **Segment sequencing layout** | After we clarify “layout” (editor vs learner). |
| 8 | **Raise a question + Discussion** | Can start with “raise question” form; expand to full discussion. |
| 9 | **Notifications** | In-app first; pairs with discussion/certificates. |
| 10 | **Thumbnail generator** | Optional; “frame picker” is small. |

---

## How to use this doc

- **Pick one:** e.g. “Let’s do slider fix first” → we debug and implement.
- **Plan one:** e.g. “Let’s design versioning (draft/publish)” → we write a short design in `docs/plans/` then implement one slice.
- **Batch:** e.g. “Slider + enable Quiz” in one session.

Tell me which item (or batch) you want to start with, and we’ll go step by step.
