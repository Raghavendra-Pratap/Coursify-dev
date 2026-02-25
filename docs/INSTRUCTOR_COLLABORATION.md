# Instructor collaboration (co-instructors)

## Overview

Instructors can **invite other instructors** to collaborate on a course. Collaborators can:

- See the course in **My Courses**
- **Edit** the course (modules, lessons, content)
- View and manage **learners** enrolled in that course
- View **analytics** for that course

Only the **course owner** (the user in `courses.created_by`) can:

- Delete the course
- **Add or remove** collaborators

## Data model

- **`course_collaborators`**: `(id, course_id, user_id, invited_by, created_at)`
  - Links a user to a course as co-instructor. No "pending" state in MVP: inviting = adding a row (user must already have an account; we look up by email and add them).
- Invite flow: owner enters an **email**; we look up `auth.users` / `user_profiles` by email. If found and they have role instructor (or we don’t check role), we insert into `course_collaborators`. If not found, show “No user found with this email” (or later: “Send invite email”).

## RLS

- **Courses**: SELECT / UPDATE allowed for `created_by = auth.uid()` **OR** `EXISTS (SELECT 1 FROM course_collaborators cc WHERE cc.course_id = courses.id AND cc.user_id = auth.uid())`. DELETE only for `created_by = auth.uid()`.
- **Modules, lessons, content_items**: same “owner OR collaborator” for SELECT and for INSERT/UPDATE/DELETE (so collaborators can edit).
- **course_analytics**: SELECT for owner OR collaborator.
- **course_collaborators**: SELECT for owner OR any collaborator on that course. INSERT/DELETE only for course owner. Optional: allow `user_id = auth.uid()` to DELETE their own row (leave course).

## UI

- **My Courses**: In the dropdown for each course, add **“Collaborators”** (or “Invite co-instructor”).
- Opens a **Collaborators** modal for that course:
  - List current collaborators (owner + co-instructors with email/name from profile).
  - **Invite by email**: input + “Invite”. Look up user by email; if found, add to `course_collaborators`; show success or “User not found”.
  - **Remove** (owner only): remove collaborator from course.
- **Learners** page: already filtered by “courses I own or collaborate on” once RLS and Learners query use collaborator course IDs.

## Admin backdoor (invisible)

- Users with `user_profiles.role = 'admin'` get owner-or-collaborator access on **all courses** via RLS (`is_course_owner_or_collaborator`). They are not in `course_collaborators` and are **hidden from the Collaborators list** so only you know they can access everything for quick fixes.

## Future

- Pending invites by email (invitee doesn’t have account yet): store invite, send email, on signup or “accept invite” add to `course_collaborators`.
- Role on collaborator (e.g. “view only” vs “can edit”) if needed.
