# Coursify LMS - Project Context

**Last Updated**: 2025-02-11  
**Status**: In active development; production at https://coursify.bsoc.space (custom domain). Develop/release from root codebase (Next.js App Router, Supabase auth, instructor/learner flows).

---

## Project Overview

**Coursify LMS** is a Learning Management System with **micro-video management** (update video segments without re-recording), external storage (Google Drive, YouTube), and target users: corporate L&D and SMEs.

### Current state
- **Auth**: Supabase; roles (admin, instructor, learner); profile and course ownership.
- **Instructor**: Dashboard, My Courses, Create Course, Learners, Analytics, Reports; Learners aligned with dashboard enrollments; Share modal uses magic link when available.
- **Learner**: Take Course (video, reading, quizzes/forms); progress and certificates (instructor-awarded).
- **Deploy**: Vercel; `develop` branch; custom domain coursify.bsoc.space; vercel.app redirects to custom domain via `vercel.json`.

### Recent completions (Feb 2025)
- Magic links for sharing (`/go/[token]`, API, Share modal).
- Redirect coursify-dev.vercel.app → coursify.bsoc.space.
- Default theme dark; devtools/right-click blocked; `select-none` on video/content.
- Learners page: same scope as Dashboard, pending invites when no enrollments, last active/joined dates, sign-up email.

---

## Key paths

- **Docs**: `docs/PROJECT_CONTEXT.md`, `docs/CODEBASE_MAP.md`, `docs/decisions/DECISIONS.md`, `docs/plans/`, `docs/sessions/`.
- **App**: `app/`, `components/`, `lib/`; API under `app/api/`; magic link: `lib/magic-link.ts`, `app/api/courses/[id]/magic-link`, `app/go/[token]`.
- **Config**: `vercel.json`, `.env.example` (NEXT_PUBLIC_APP_URL, MAGIC_LINK_SECRET).

---

## Pending / optional

- Set **NEXT_PUBLIC_APP_URL** and **MAGIC_LINK_SECRET** in Vercel production env.
- Add coursify.bsoc.space to Supabase redirect URLs if using OAuth.
- Further product/UX work as needed.

For deeper history and consolidation notes, see `docs/old_docs/PROJECT_CONTEXT.md` and `docs/HANDOFF_SUMMARY.md`.
