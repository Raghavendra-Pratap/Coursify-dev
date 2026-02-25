# Recovery Status: Coursify LMS

**Purpose:** Recover context — what has been achieved and what still needs to be done.  
**Last updated:** From codebase and session context.

---

## Quick reference

| Document | Location | Purpose |
|----------|----------|---------|
| Project overview | `PROJECT_CONTEXT.md` (root) | Strategy, features, completed work |
| Code structure | `docs/CODEBASE_MAP.md` | Folders, entry points, conventions |
| Technical reference | `docs/TECHNICAL_REFERENCE.md` | Stack, types, DB, APIs |
| Clarifications & gaps | `docs/CLARIFICATIONS.md` | Q&A, gap analysis, follow-up questions |
| Handoff | `docs/HANDOFF_SUMMARY.md` | Decided direction, next steps |
| **This file** | `docs/RECOVERY_STATUS.md` | Achieved vs to-do snapshot |

**Final product codebase:** `coursify-app/` (Next.js App Router, auth, learner flow).  
**Root (`components/`, `app/`):** Reference/prototype with full admin UI (Dashboard, Learners, Reports, Create Course, etc.).

---

## What has been achieved

### Root app (reference/prototype)

| Area | Achievement | Evidence |
|------|-------------|----------|
| **Learners – Invite flow** | Real courses dropdown; invites stored in DB; CSV parsing | `components/pages/Learners.tsx`: fetches published courses, inserts into `learner_invites`, parses CSV for emails |
| **Profile – Courses tab** | Shows real enrolled courses with progress | `components/pages/Profile.tsx`: `enrolledCourses` from enrollments + course titles; lists course title, Completed or progress % |
| **Account – Delete account** | API + UI wired | `app/api/auth/delete-account/route.ts` (POST, service role delete); `components/pages/AccountSettings.tsx` calls API, then sign-out and redirect |
| **Reports – Generate** | Real CSV download from Supabase | `components/pages/Reports.tsx`: `handleGenerateReport` fetches enrollments, courses, user_profiles; builds CSV; triggers download |
| **Course Preview** | Uses real course data; outline when no video | `components/pages/CreateCourse.tsx`: Preview modal shows first-lesson title when no video, live stats, and “Course outline” (modules + lesson count + duration) |
| **Schema** | `learner_invites` table defined | `database/schema.sql`: `learner_invites` (email, course_id, status, created_by, RLS) |

### coursify-app (learner-facing product)

| Area | Achievement | Evidence |
|------|-------------|----------|
| **LearnerView – Lessons per module** | Sidebar loads and lists lessons per module; click to open lesson | `coursify-app/components/LearnerView.tsx`: fetches lessons by module ids, `lessonsByModuleId`, sidebar lists lessons with selection state |

---

## What still needs to be done

### High impact / blocking

| Item | Location | Current state | Required action |
|------|----------|---------------|-----------------|
| **Learner invites in Supabase** | DB | Table in `database/schema.sql` only | Run `CREATE TABLE learner_invites` (+ RLS) in Supabase SQL Editor if not yet migrated |
| **Learner reminders in Supabase** | DB | Table in `database/schema.sql` | Run `CREATE TABLE learner_reminders` (+ RLS) in Supabase SQL Editor if not yet migrated |
| **Courses `status` column** | Root Learners dropdown | Code filters `status = 'published'` | Ensure `courses` has `status` (or use existing column e.g. `is_published`) in your Supabase project |

### Placeholders / config messages (by area) — completed where possible

| Area | File | Status |
|------|------|--------|
| **Dashboard** | `Dashboard.tsx` | Done: real stats from Supabase (courses, learners, enrollments, completion %, top courses) |
| **Analytics** | `Analytics.tsx` | Done: real overview stats and course performance from enrollments/user_profiles |
| **My Courses** | `MyCourses.tsx` | Done: load with module/lesson/enrollment counts; archive and duplicate persist to Supabase |
| **Learners – Reminders** | `Learners.tsx` | Done: reminders saved to `learner_reminders`; email still requires external service |
| **Profile – Achievements** | `Profile.tsx` | Done: derived achievements (first course, 5/10 lessons, 3 courses) from progress/enrollments |
| **Profile – Certificates** | `Profile.tsx` | Done: completed enrollments shown as certificates with course title and date |
| **Reports – Schedule** | `Reports.tsx` | Not done: backend cron/worker needed to send scheduled reports |
| **Learning preferences** | `LearningPreferences.tsx` | Preference-loop exists; completion/activity feeds it |

### TODOs in code

| Location | TODO | Priority |
|----------|------|----------|
| `CreateCourse.tsx` | Reading content persistence | **Done:** schema + `reading_materials` + save in CreateCourse |
| `coursify-app/components/LearnerView.tsx` | Seamless playback of segments | **Done:** one segment at a time, `onEnded` advances or marks complete |
| Reports | Cron for scheduled generation | Optional: `GET /api/reports/generate` + CRON_SECRET |

### Optional / later

- **Reminders:** Email sending (e.g. SendGrid/Resend) for learner reminders; persistence is done.
- **Report scheduling:** Cron/worker to call reports API (user holding for now).
- **Learner view:** “My learning” landing and role-based default (see `docs/LEARNER_VIEW_FINDINGS.md`).

---

## Recovery flow (from .recovery.cursorrules)

```
/context → /map → /technical → /gaps → (developer answers) → /module (if needed) → /finalize
```

- **Already done:** PROJECT_CONTEXT (root), CODEBASE_MAP, TECHNICAL_REFERENCE, CLARIFICATIONS (answered), HANDOFF_SUMMARY, DECISIONS, CreateCourse module doc.
- **This doc:** Snapshot of “achieved vs to-do” for current development.
- **Next:** Use this plus CLARIFICATIONS/HANDOFF for prioritization; run DB migrations where needed; implement remaining placeholders in order of priority.

---

## Checklist for “ready to develop”

- [x] Context recovered (this doc + existing docs)
- [x] Achieved work listed (Learners invite, Profile courses, Delete account, Reports CSV, Course Preview, LearnerView lessons, reading persistence, seamless playback, reports API)
- [x] To-do and placeholders listed
- [ ] `learner_invites` / `learner_reminders` / `reading_materials` (and any other new tables) applied in Supabase if using root schema
- [ ] Supabase env configured for root app (Learners, Reports, Dashboard, Analytics, My Courses)
- [ ] Decide: port root features into coursify-app vs keep root as reference (see HANDOFF §4)

**User-facing pending checklist:** See **`docs/PENDING_YOUR_ACTION.md`** for what’s still pending or needed from your end (DB, env, deploy, optional items).

---
**Status:** Context recovery complete. Use this file to track achieved work and remaining tasks.
