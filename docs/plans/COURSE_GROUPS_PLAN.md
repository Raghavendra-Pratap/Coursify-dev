# Plan: Course groups (programs) — invite to multiple courses at once

## Problem

Creators with a **certificate-style track** (e.g. six Coursera-imported courses for “Google Project Management”) today must:

1. Open **Invite learners** for course 1 → send  
2. Repeat for course 2, 3, …  

Learners get multiple emails and enroll one course at a time.

## Goal

**One invite → multiple courses.** Optionally save a named **group / program** (e.g. “Google PM Certificate”) and reuse it.

---

## Current behaviour (today)

| Piece | Behaviour |
|-------|-----------|
| `learner_invites` | One row per `(email, course_id)` |
| `/api/invites/process-pending` | On login, enrolls user in **every** pending invite with a `course_id` |
| `/api/email/invite` | One course per email (boarding-pass template) |
| Learners UI | Single course dropdown |

**Phase 1 (shipped):** multi-select courses in the invite modal → N invite rows per learner → **one combined email** listing all courses → `process-pending` enrolls in all.

**Phase 2 (shipped):** saved **course programs** — create on Learners page, invite via program dropdown → one `learner_invites` row with `program_id` → enroll all members on sign-up.

Run migration: `database/ADD_COURSE_PROGRAMS.sql` in Supabase SQL Editor.

---

## Phase 2: Saved course programs (implemented)

Named bundles instructors create once and invite to repeatedly.

### Schema (proposed)

```sql
CREATE TABLE course_programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE course_program_members (
  program_id UUID NOT NULL REFERENCES course_programs(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (program_id, course_id),
  UNIQUE (program_id, order_index)
);

ALTER TABLE learner_invites
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES course_programs(id) ON DELETE SET NULL;
```

- `course_id` on invite: single-course invite (existing).  
- `program_id` on invite: enroll in **all** members on accept (expand to N enrollments in `process-pending`).

### API (proposed)

| Route | Purpose |
|-------|---------|
| `GET/POST /api/instructor/programs` | List / create program |
| `PATCH/DELETE /api/instructor/programs/[id]` | Update title, members |
| Invite flow | Select program OR pick courses ad hoc |

### UI (proposed)

- **My Courses** or **Learners**: “Create program” → name + multi-select published courses → save.  
- **Invite learners**: dropdown “Program (optional)” + still allow ad hoc multi-select.  
- Email subject: `{inviter} invited you to {program title} ({n} courses)`.

### RLS

- Programs: `created_by = auth.uid()` or admin; members only for courses the user owns/collaborates on.

---

## Phase 3 (later)

- Learner **My learning** grouped by program (accordion).  
- Program progress (% courses completed).  
- Magic link / QR to `/learn?program={id}`.  
- Import sheet column `program_title` to attach imported course to a program.

---

## Related

- Sheet import hierarchy: [COURSE_FROM_SHEET_PLAN.md](./COURSE_FROM_SHEET_PLAN.md)  
- Email: `RESEND_EMAIL.md`, `/api/email/invite`, `process-pending`
