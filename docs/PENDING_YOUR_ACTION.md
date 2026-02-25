# Pending items & what to do from your end

**Last updated:** From current codebase and docs. Use this as your checklist.

---

## ✅ You said done

- **DB updated** – You ran the reading-support migration (e.g. `database/ADD_READING_SUPPORT.sql`), so `content_type = 'reading'` and `reading_materials` are in place.
- **Cron** – Holding for now; no action needed. When you want scheduled reports, call `GET /api/reports/generate` with `Authorization: Bearer <CRON_SECRET>`.

---

## 1. Database (Supabase)

| Item | Action | Notes |
|------|--------|--------|
| **Main schema** | If you haven’t already, run `database/schema.sql` in Supabase SQL Editor (full schema). | Creates all tables + RLS. |
| **Reading support** | You confirmed this is done. | Adds `reading` to `content_items` and `reading_materials` table. |
| **Missing tables (if any)** | If your project was created before some tables were added, run `database/MIGRATE_MISSING_TABLES.sql`. | Adds `content_items`, `quizzes`, `quiz_questions`, `forms`, `form_fields`, `course_versions`, `quiz_attempts`, `learner_invites`, `learner_reminders` if missing. |
| **Learner invites / reminders** | Ensure `learner_invites` and `learner_reminders` exist if you use Learners page (invite + reminders). | In main schema or in MIGRATE_MISSING_TABLES. |
| **Courses `status`** | Root Learners dropdown filters `status = 'published'`. | Ensure `courses` has a `status` column (or code is aligned with your column, e.g. `is_published`). |
| **External URL video** | Optional. To allow `external_url` for video segments, run the ALTER in `SETUP_CHECKLIST.md` §2. | Only if you use external video URLs. |

---

## 2. Environment

| Item | Action | Notes |
|------|--------|--------|
| **Local** | `.env.local` has `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and (recommended) `NEXT_PUBLIC_APP_URL`. | See `SETUP_CHECKLIST.md` and `env.template` / `.env.example`. |
| **Optional** | `SUPABASE_SERVICE_ROLE_KEY` for delete-account API and reports API. | Server-side only; never expose to client. |
| **Production** | When you deploy, set the same vars in your host (e.g. Vercel). Add production URL to Supabase Auth → Redirect URLs and Site URL. | See `DEPLOYMENT.md`. |

---

## 3. Deployment (when you’re ready)

| Step | Action |
|------|--------|
| 1 | Supabase: production URL in Auth → Redirect URLs (and Site URL). |
| 2 | Push code; connect repo to Vercel (or other host). |
| 3 | Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`; optionally `SUPABASE_SERVICE_ROLE_KEY`. |
| 4 | Deploy; test sign-in and course save/publish. |
| 5 | (Optional) Custom domain; then update Supabase URLs and `NEXT_PUBLIC_APP_URL`. |

Details: `DEPLOYMENT.md`.

---

## 4. Optional / later (no action required now)

| Area | Status | When you care |
|------|--------|----------------|
| **Report scheduling** | Cron not implemented (you’re holding). | Later: call `GET /api/reports/generate` with `CRON_SECRET`. |
| **Learner reminder emails** | Reminders save to DB; no email sent. | Later: add SendGrid/Resend (or similar). |
| **Learner view / “My learning”** | Documented in `docs/LEARNER_VIEW_FINDINGS.md`; not implemented. | When you want learners to land on “My learning” and continue courses. |
| **Google Drive picker** | UI only; OAuth/playable URL not wired. | When you use Drive for video. |
| **coursify-app** | Has its own schema (e.g. `video_segments.lesson_id`). | If you run coursify-app, ensure its DB schema matches what it expects. |

---

## 5. Quick “am I good?” check

- [ ] Supabase: main schema applied; reading support applied (you said done); any missing tables from migration script if needed.
- [ ] `.env.local`: Supabase URL + anon key (and optional service role, app URL).
- [ ] App: `npm run build` passes; sign-in and Create Course → Save / Publish work.
- [ ] (Optional) Learners page: invite and reminders work if `learner_invites` and `learner_reminders` exist.
- [ ] When deploying: production URL in Supabase Auth; env vars set on host.

---

## Summary

**Must-do from your side:**  
(1) DB in good shape (schema + reading + any migrations you need), (2) env set for local (and for production when you deploy), (3) Supabase Auth redirect URLs when you go live.

**Already done on your side:** DB updated for reading; cron deferred.

**Optional / when you’re ready:** Learner “My learning” view, report cron, reminder emails, Drive OAuth, deployment.

For learner-mode design and options, see `docs/LEARNER_VIEW_FINDINGS.md`.
