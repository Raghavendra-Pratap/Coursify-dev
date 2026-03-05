# Coursify LMS — One Pager

**Tagline:** The LMS that evolves with you. A learning platform built around micro-video and the tools you already use.

---

## What It Is

**Coursify LMS** is a learning management system for **corporate L&D and subject-matter experts** who need to keep training up to date without re-recording entire courses. It combines **micro-video editing**, **familiar content sources** (Google Drive, YouTube), and **role-based workflows** for instructors and learners.

---

## MVPs (Core Product)

| MVP | Description |
|-----|--------------|
| **Micro-video management** | Edit or replace **specific video segments** inside a lesson without re-recording the whole video. Timestamp-based streaming; no heavy server-side stitching. |
| **Course builder** | Drag-and-drop **modules → lessons → content** (videos, quizzes, Google Forms, reading). Version history and draft/publish/archived lifecycle. |
| **Instructor workspace** | **Dashboard** (stats, engagement, activity), **My Courses** (grid/list, share, magic links), **Create Course**, **Learners** (enrollments, invites, progress, certificates), **Analytics**, **Reports**. |
| **Learner experience** | **Take Course**: video playback with segments, reading content, embedded quizzes/forms; progress tracking and **instructor-awarded certificates**. |
| **Auth & roles** | Supabase-backed **admin / instructor / learner** roles; profiles; course ownership and collaboration. |

---

## Key Highlights

- **No content lock-in** — Use **Google Drive** and **YouTube** as primary sources; reduce migration friction and storage cost.
- **Share without exposing IDs** — **Magic links** (`/go/TOKEN`) for course sharing; optional revocation via secret; production on custom domain (e.g. **coursify.bsoc.space**).
- **Cost-conscious** — Designed for **&lt;1000 users** on free-tier-friendly stack (Supabase, Vercel); no need to host video yourself.
- **Content protection** — Right-click and devtools shortcuts blocked on protected content; `select-none` on video/reading to reduce casual URL copying.
- **Single, modern stack** — Next.js App Router, TypeScript, Tailwind; one codebase for develop and release.

---

## Target Users

- **Corporate L&D teams** — Keep compliance and product training current with minimal re-production.
- **SMEs and fast-moving teams** — Update specific sections of courses as processes or products change.

---

## Status

- **Live:** https://coursify.bsoc.space  
- **Deploy:** Vercel; custom domain; vercel.app traffic redirected to primary URL.  
- **Docs & context:** `docs/PROJECT_CONTEXT.md`, `docs/CODEBASE_MAP.md`, `docs/decisions/DECISIONS.md`.

---

*Coursify LMS — The LMS that evolves with you.*
