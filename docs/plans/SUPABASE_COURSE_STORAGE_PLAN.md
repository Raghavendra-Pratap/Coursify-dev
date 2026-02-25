# Supabase Usage & Course Storage Plan

**Goal:** Use Supabase efficiently for Coursify — clear model for course/module/video data, minimal cost, no large spend on storage or egress.

---

## 1. Where course data lives today (schema)

Your schema already matches the hierarchy you described:

```
courses
  └── modules (order_index)
        └── lessons (order_index, duration_seconds)
              └── content_items (content_type: 'video' | 'quiz' | 'form', order_index)
                    ├── video_segments  ← video link + timestamps live here
                    ├── quizzes (+ quiz_questions)
                    └── forms (+ form_fields)
```

**Video link and streaming timestamps** are stored only in **`video_segments`**:

| Column | Purpose | Cost impact |
|--------|---------|-------------|
| `content_item_id` | Links to one “video” content item in a lesson | FK, tiny |
| `name` | Segment label (e.g. "Intro clip") | Text, tiny |
| `duration_seconds` | Length of segment | Integer |
| `start_time_seconds` | Start for streaming (e.g. 0) | Integer |
| `end_time_seconds` | End for streaming (e.g. 120) | Integer |
| `source` | `'youtube' \| 'google_drive' \| 'external_url' \| 'upload'` | Text |
| `source_url` | **The actual video URL** (YouTube watch URL, Drive link, etc.) | Text only — no file bytes |
| `storage_path` | Optional: Supabase Storage path or Drive file ID if you need it | Text |

So: **one row per “segment”** (one URL + one time window). No video file content is stored in Supabase — only metadata and the link. That keeps DB size and cost very low.

---

## 2. Cost‑efficient strategy (honest view)

### What costs money on Supabase

- **Database**: Rows, API calls. Your course/module/lesson/content_item/video_segment rows are small (UUIDs, integers, short text). Even hundreds of courses and thousands of segments are cheap.
- **Storage (Supabase Storage)**: Storing **video files** here would be expensive (large files + egress). Free tier is 1 GB; beyond that, storage + bandwidth add up quickly.
- **Realtime**: If you use it; for course structure and progress you usually don’t need it.
- **Auth**: Free tier is generous; you’re fine until very high MAU.

### Recommended approach: **store only links + timestamps; keep video outside Supabase**

- **YouTube / Google Drive / external URL**:  
  - Store in DB: `video_segments.source` + `video_segments.source_url` + `start_time_seconds` / `end_time_seconds`.  
  - Video bytes and streaming stay on YouTube/Drive/CDN. Supabase pays nothing for that. Your app just passes the URL and time window to the player (as you already do with `getYouTubeEmbedUrl`, etc.).

- **Supabase Storage**:  
  - Use only for **small assets** if needed: course thumbnails, small images, maybe small PDFs.  
  - **Do not** use it for bulk video uploads if you want to keep cost low. If you support “upload” later, options are:  
    - Keep “upload” as “paste an external URL” (e.g. Vimeo, Wistia, your own CDN), or  
    - Offload uploads to a dedicated video host (Bunny, Cloudflare Stream, etc.) and store only the resulting URL in `video_segments.source_url`.

So: **course table (and modules/lessons/video segments) = structure + links + timestamps in the DB; video files live elsewhere.** That’s the most efficient use of Supabase for your case.

---

## 3. How we save the “course table” (and the rest)

Conceptually:

1. **courses**  
   - One row per course: `title`, `description`, `status`, `created_by`, `thumbnail_url` (optional), etc.  
   - No video data here.

2. **modules**  
   - One row per module: `course_id`, `title`, `order_index`.  
   - Ordered by `order_index` when you load “modules for this course”.

3. **lessons**  
   - One row per lesson: `module_id`, `title`, `order_index`, `duration_seconds` (can be derived from content if you prefer).  
   - Ordered by `order_index` per module.

4. **content_items**  
   - One row per “block” in a lesson: `lesson_id`, `content_type` (`'video' | 'quiz' | 'form'`), `order_index`.  
   - So one lesson can have: video block, then quiz block, then another video block, etc.

5. **video_segments**  
   - One row per segment: `content_item_id`, `name`, `duration_seconds`, `start_time_seconds`, `end_time_seconds`, `source`, `source_url` (and optionally `storage_path`).  
   - This is **where the video link and timestamps for streaming are saved**. No file bytes.

6. **quizzes / quiz_questions, forms / form_fields**  
   - As today: linked to `content_item_id` for quiz/form content items.

So “saving the course” =:

- Insert/update **courses**.
- For each module: insert/update **modules**.
- For each lesson: insert/update **lessons**.
- For each content block: insert/update **content_items**; for video blocks, insert/update **video_segments** (with URL + start/end seconds).

Your existing `CreateCourse` save logic already follows this pattern (course → modules → lessons → content_items → video_segments). The main thing is to **not** put video file data in Supabase — only the row with `source` + `source_url` + timestamps.

---

## 4. Optional: course_versions and “snapshots”

You have **course_versions** with a `course_snapshot` JSONB. That’s useful for “view previous version” without recomputing. Be aware:

- Storing a **full course snapshot** (all modules/lessons/content/video segment data) in JSONB will grow with course size. For cost control, either:  
  - Use it only for “last N versions” and limit size, or  
  - Omit large blobs (e.g. don’t duplicate full quiz payloads every time) and store only structural IDs + changed fields.  
So: versioning is fine; keep snapshots small or bounded.

---

## 5. Summary table: where everything is saved

| What | Where it’s saved | Cost note |
|------|------------------|-----------|
| Course title, description, status | `courses` | Tiny |
| Module list and order | `modules` | Tiny |
| Lesson list, order, duration | `lessons` | Tiny |
| “This lesson has video / quiz / form” | `content_items` | Tiny |
| **Video link (URL)** | `video_segments.source_url` | Text only |
| **Streaming timestamps** | `video_segments.start_time_seconds`, `end_time_seconds` | Integers |
| Video file bytes | **Not in Supabase** (YouTube, Drive, or external host) | No Supabase cost |
| Thumbnails / small assets | Optional: Supabase Storage (bucket) | Keep total size small |
| Quizzes / forms | `quizzes`, `quiz_questions`, `forms`, `form_fields` | Small |
| Enrollments, progress | `enrollments`, `progress` | Small |

---

## 6. Questions for you (to lock the plan)

1. **“Upload” source**  
   - Do you want to support **real file upload** (user selects a video file) in the near term?  
   - If no: we can treat “upload” as “paste a link” (external_url) and only store URL + timestamps.  
   - If yes: we should plan a separate, cheap host (e.g. Cloudflare Stream, Bunny) and still store only the final URL in `video_segments`; avoid storing large video in Supabase Storage.

2. **Thumbnails**  
   - Do you need course/lesson thumbnails stored in Supabase? If yes, we’ll keep them in one bucket, small size (e.g. compressed, max dimensions), so Storage stays within free tier or low cost.

3. **Versioning**  
   - Do you need full “course version history” with restorable snapshots? If yes, we’ll keep `course_versions` but limit snapshot size or retention (e.g. last 5 versions, or only diff).

4. **Reading content**  
   - You have a TODO for “reading_materials”. Should that be: (a) a URL only (e.g. link to Google Doc), or (b) stored HTML/text in DB? (a) = one text column or JSON; (b) = a bit more DB size but still small.)

Once you answer these, we can lock the plan (and, if you want, add a one‑page “runbook” in the repo: “How we use Supabase for courses” and “What we never store in Supabase”).  

**Bottom line:** Your schema already supports “course → modules → lessons → video link + timestamps” in a cost‑efficient way. The main lever to keep cost low is: **video = URL + timestamps in DB only; video files live outside Supabase.**
