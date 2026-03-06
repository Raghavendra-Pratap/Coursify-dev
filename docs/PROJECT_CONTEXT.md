# Coursify LMS - Project Context

**Last Updated**: 2025-03  
**Status**: In active development; production at https://coursify.bsoc.space (custom domain). Develop/release from root codebase (Next.js App Router, Supabase auth, instructor/learner flows). Default branch: **develop**.

---

## Project Overview

**Coursify LMS** is a Learning Management System with **micro-video management** (update video segments without re-recording), external storage (Google Drive, YouTube), and target users: corporate L&D and SMEs.

### Current state
- **Auth**: Supabase; roles (admin, instructor, learner); profile and course ownership.
- **Instructor**: Dashboard, My Courses, Create Course (with **Import from sheet** CSV), Learners, Analytics, Reports; Share modal uses magic link when available.
- **Learner**: My Courses (enrolled), Take Course (video, reading, quizzes/forms, Q&A, notes); **My Notes** (by course, localStorage); **Notifications**; **Q&A** threads; course **ratings** (1–5 + review); progress and certificates (instructor-awarded).
- **Deploy**: Vercel; `develop` branch; custom domain coursify.bsoc.space; vercel.app redirects via `vercel.json`.

### Recent completions (Mar 2025)
- **Course import from sheet**: Create Course → Import from sheet; CSV parser (`lib/parseCourseSheet.ts`), segment_sequence, draft creation, template at `public/course-import-template.csv`; API `POST /api/instructor/courses/import-from-sheet`.
- **Learner mode**: Notes sidebar, Q&A threads (`course_questions`), Notifications (`user_notifications`), My Notes page, learner course cards (modules, duration, rating, last updated), rate-course modal.
- **Build fixes**: `params` vs `params()` in rating route; `forEach` instead of `for..of` over Map iterators (MyNotes, parseCourseSheet) for Vercel build.
- **Merge**: feature/learner-mode-advancements merged into develop (no PR).

### Earlier (Feb 2025)
- Magic links for sharing (`/go/[token]`, API, Share modal).
- Redirect coursify-dev.vercel.app → coursify.bsoc.space.
- Default theme dark; devtools/right-click blocked; `select-none` on video/content.
- Learners page: same scope as Dashboard, pending invites, last active/joined dates.

---

## Key paths

- **Docs**: `docs/PROJECT_CONTEXT.md`, `docs/CODEBASE_MAP.md`, `docs/decisions/DECISIONS.md`, `docs/plans/`, `docs/sessions/`.
- **App**: `app/`, `components/`, `lib/`; API under `app/api/`; magic link: `lib/magic-link.ts`, `app/api/courses/[id]/magic-link`, `app/go/[token]`.
- **Config**: `vercel.json`, `.env.example` (NEXT_PUBLIC_APP_URL, MAGIC_LINK_SECRET).

---

## Course and module names

- **Database**: `courses.title` and `modules.title` are **TEXT** (no character limit in Postgres).
- **UI**: No app-level character limit is enforced. Very long names are truncated in some places (e.g. Take Course header). For a smooth UI, keeping **course and module titles under ~200 characters** is recommended. Long names do not cause React #185 or other front-end errors by themselves.

---

## Pending / optional

- Set **NEXT_PUBLIC_APP_URL** and **MAGIC_LINK_SECRET** in Vercel production env.
- Add coursify.bsoc.space to Supabase redirect URLs if using OAuth.
- Further product/UX work as needed.

For deeper history and consolidation notes, see `docs/old_docs/PROJECT_CONTEXT.md` and `docs/HANDOFF_SUMMARY.md`.
