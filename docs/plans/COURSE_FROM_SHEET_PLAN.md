# Plan: Create Entire Course from Sheet Upload

## Goal

- Add a **button** (e.g. on My Courses or Create Course) that lets the creator **upload a spreadsheet** (CSV or Excel).
- The sheet contains all data needed for **one course**: course info, modules, lessons, and content items (video, reading, quiz, form).
- The app **parses the sheet**, validates it, creates the course in the DB as **draft**, then redirects the creator to the **course editor** to review and publish (or edit further).

---

## Current Data Model (recap)

| Level | Table | Key fields |
|-------|--------|------------|
| Course | `courses` | title, description, status (draft/published/archived), thumbnail_url, metadata |
| Module | `modules` | course_id, title, description, order_index |
| Lesson | `lessons` | module_id, title, description, order_index, duration_seconds |
| Content | `content_items` | lesson_id, content_type (video \| reading \| quiz \| form), order_index |
| Video | `video_segments` | content_item_id, name, duration_seconds, start_time_seconds, end_time_seconds, source, source_url, storage_path |
| Reading | `reading_materials` | content_item_id, title, type (url \| native), url, body |
| Quiz | `quizzes` + `quiz_questions` | title, passing_score; questions with options, correct_answer |
| Form | `forms` | title; optional form_url for Google Form |

Existing flow: **CreateCourse** editor builds the same hierarchy and saves via **Save** (new course: insert course + modules + lessons + content_items + video_segments/reading_materials/etc.; existing: POST `/api/instructor/courses/[courseId]/structure`).

---

## Proposed Sheet Structure (to discuss)

Two options; we can pick one or combine (e.g. template + examples).

### Option A: Single sheet, one row per content item (recommended for v1)

One CSV/Excel sheet. **First row**: course-level (course title, course description). **Second row**: column headers. **Data rows**: one row per **content item**, with hierarchy expressed by repeating module/lesson columns (blank = same as previous row).

| Column | Required | Description |
|--------|----------|-------------|
| **course_title** | Yes (first row) | Course title (only first row used) |
| **course_description** | No | Course description |
| **module_order** | Yes | 0-based or 1-based index for module order |
| **module_title** | Yes | Module name |
| **module_description** | No | Module description |
| **lesson_order** | Yes | Order of lesson within module |
| **lesson_title** | Yes | Lesson name |
| **lesson_description** | No | Lesson description |
| **lesson_duration_seconds** | No | Total lesson duration (can be derived from content if omitted) |
| **content_order** | Yes | Order of this content item within the lesson |
| **content_type** | Yes | `video` \| `reading` \| `quiz` \| `form` |
| **segment_sequence** | No (video) | 0-based order of this segment within the video block. Rows with the same module, lesson, and content_order and type video are merged into one content item; segment_sequence defines playback order. Omit or 0 for a single segment. |
| **video_name** | If video | Segment name |
| **video_source** | If video | `youtube` \| `google_drive` \| `external_url` (upload not supported from sheet) |
| **video_url** | If video | URL (YouTube, Drive share link, or external) |
| **video_duration_seconds** | No | Duration in seconds |
| **video_start_seconds** | No | Clip start (optional) |
| **video_end_seconds** | No | Clip end (optional) |
| **reading_type** | If reading | `url` \| `native` |
| **reading_title** | If reading | Title |
| **reading_url** | If reading (url) | Link |
| **reading_body** | If reading (native) | Plain text / markdown |
| **quiz_title** | If quiz | Quiz title |
| **quiz_form_url** | If quiz (Google Form) | Form URL for embed |
| **form_title** | If form | Form title |
| **form_url** | If form | Google Form URL |

**Parsing rules**:
- For any row where `module_title` or `lesson_title` is blank, reuse the previous row’s module/lesson.
- **Segments**: Rows with the same module, lesson, and `content_order` and `content_type=video` are treated as one video content item with multiple segments. Use `segment_sequence` (0, 1, 2, …) to order segments. Stored as `segment_index` in the database.

**Example (minimal)**:

```csv
course_title,course_description,module_order,module_title,lesson_order,lesson_title,content_order,content_type,video_name,video_source,video_url
Introduction to Sales,,0,Welcome,0,Overview,0,video,Intro,youtube,https://www.youtube.com/watch?v=xxx
Introduction to Sales,,0,Welcome,0,Overview,1,reading,,,,"",url,Read this doc,
Introduction to Sales,,0,Welcome,1,Key concepts,0,video,Main lesson,youtube,https://www.youtube.com/watch?v=yyy
```

---

### Option B: Multiple sheets (Course + Outline)

- **Sheet "Course"**: One row. Columns: `course_title`, `course_description`, `thumbnail_url` (optional).
- **Sheet "Outline"**: One row per **lesson**. Columns: `module_order`, `module_title`, `lesson_order`, `lesson_title`, `lesson_duration_seconds`, then repeated blocks for content: `content_1_type`, `content_1_video_url`, `content_1_reading_url`, … (can be limited to e.g. 5 content items per lesson for v1).

Easier to read for “one row per lesson”, but wider and more rigid. Can be added as an alternative format later.

---

## Agreed decisions (locked)

1. **File format**: CSV only for v1.
2. **Encoding**: UTF-8.
3. **Hierarchy**: Row per content item with “repeat previous” for module/lesson (Option A).
4. **Video**: Only link-based sources (youtube, google_drive, external_url) from sheet.
5. **Quiz/Form**: Title + optional form URL only in v1.
6. **Template**: Yes — downloadable template CSV (headers + 1–2 example rows) linked from the upload UI.
7. **Button placement**: Inside the Create Course page only (“Import from sheet” / “Create from sheet”).
8. **Validation**: Required columns present; content_type in allowlist; URLs valid. On error: report row numbers and messages, do not create course.

---

## Implementation Plan

### 1. Backend: Parse + validate + create draft course

- **New API route** e.g. `POST /api/instructor/courses/import-from-sheet`
  - Input: `FormData` with file `sheet` (and optionally `filename`).
  - Steps:
    1. Parse file (CSV or xlsx) into rows/columns.
    2. Validate structure (headers, required columns, content_type, URLs). Return 400 with **validation errors** (row numbers + messages) if invalid.
    3. Build in-memory structure: `{ title, description, modules: [{ title, description?, order, lessons: [{ title, description?, order, duration_seconds?, content: [{ type, order, videoSegment?, reading?, quiz?, form? }] }] }] }` matching what CreateCourse / structure API expect.
    4. Create course: insert into `courses` with `status: 'draft'`, `created_by: current user`.
    5. For each module: insert `modules`; for each lesson: insert `lessons`; for each content item: insert `content_items`, then `video_segments` / `reading_materials` / `quizzes`+`quiz_questions` / `forms` as needed.
    6. Optionally create a `course_versions` snapshot for “Import from sheet”.
    7. Return `{ courseId: string }` and 201.

- **Libraries**: Use a CSV parser (e.g. `csv-parse` or built-in) and, if we support Excel, `xlsx` or similar. Keep parsing in API route (or a shared `lib/parseCourseSheet.ts` used only server-side).

### 2. Frontend: Upload button + flow

- **Entry point**: “Create from sheet” or “Import course” button:
  - On **My Courses**: next to “Create course” (opens upload UI or modal).
  - Or from **Create Course** page: e.g. “Start from spreadsheet” that opens the same upload flow.
- **Upload UI**:
  - File input (accept `.csv` and optionally `.xlsx`).
  - Optional: link to **download template** (CSV with headers + 1–2 example rows).
  - On submit: `POST /api/instructor/courses/import-from-sheet` with the file.
- **Response handling**:
  - **201**: Redirect to `/instructor/courses/[courseId]/edit` (or whatever the CreateCourse editor URL is) so the creator can review and publish.
  - **400**: Show validation errors (e.g. “Row 5: content_type must be video, reading, quiz, or form”).
  - **401/403**: Show “Not authorized”.
  - **500**: Show “Import failed”, optionally with message.

### 3. Template and docs

- Provide a **template CSV** (and optional Excel) with:
  - Correct headers.
  - 1 course row + 2–3 data rows (mix of video + reading) so creators can fill in.
- Short doc (or in-app help): “How to structure your sheet” (column meanings, examples, “repeat previous” rule).

### 4. Edge cases

- **Duplicate module/lesson**: Same (module_order, module_title) or (lesson_order, lesson_title) in different rows — treat as same module/lesson (merge content).
- **Empty rows**: Skip.
- **Missing course title**: Take from first data row’s `course_title` or require first row to have course_title.
- **Permissions**: Only authenticated instructor (or admin) can call import API; `created_by` = current user; RLS on courses/modules/lessons/content already enforce ownership.

---

## Summary

| Item | Proposal |
|------|----------|
| **Sheet format** | Single sheet, one row per content item; first row course info, then headers, then data. Blank module/lesson = repeat previous. |
| **File types** | CSV only for v1. |
| **Template** | Downloadable template CSV (headers + example rows) linked from upload UI. |
| **Video** | Link-only (youtube, google_drive, external_url). |
| **Quiz/Form** | Title + optional form URL in v1. |
| **Output** | Course created as **draft**; redirect to course editor to review and publish. |
| **API** | `POST /api/instructor/courses/import-from-sheet` (multipart file). |
| **UI** | “Import from sheet” inside **Create Course** page only → file picker + template download link → submit → redirect or show errors. |

Once we align on the sheet structure (columns, required fields, and whether we want Option A only or also Option B), implementation can follow this plan.
