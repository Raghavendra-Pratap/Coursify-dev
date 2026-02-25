# Live testing checklist — release readiness

Use this before releasing. Covers invite candidates, emails, auth, courses, and reports with **live** Supabase and (optionally) Resend.

---

## 1. Environment (required for live testing)

- [ ] **Supabase**
  - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` (and in production env)
  - Database: `database/schema.sql` and `database/MIGRATE_MISSING_TABLES.sql` applied (includes `learner_invites`, `learner_reminders`)
- [ ] **Auth redirects**
  - Supabase Dashboard → **Authentication** → **URL Configuration**
  - **Redirect URLs**: add your live URL (e.g. `https://your-app.vercel.app/**`) and local (`http://localhost:3000/**`)
  - **Site URL**: set to production URL when going live
- [ ] **App URL**
  - `NEXT_PUBLIC_APP_URL` = production URL (e.g. `https://your-app.vercel.app`) so invite/reminder emails link correctly
- [ ] **Email (invites + reminders)**
  - [Resend](https://resend.com): sign up, create API key, add to env:
    - `RESEND_API_KEY` = your Resend API key
    - Optional: `RESEND_FROM_EMAIL` = `Coursify <notifications@yourdomain.com>` (after verifying domain); otherwise uses `onboarding@resend.dev` for testing
  - For **reminder emails** to resolve learner email by `userId`: set `SUPABASE_SERVICE_ROLE_KEY` (server-side only)

---

## 2. Pre-flight (local)

```bash
npm install
npm run build
npm run start
```

- [ ] App loads at `http://localhost:3000`
- [ ] No build errors

---

## 3. Auth

- [ ] **Sign in** (email/password): works and shows your name/initials
- [ ] **Sign out**: sidebar (expanded and collapsed) and Profile modal → Sign Out; UI shows Guest
- [ ] **Sign up**: create a second user (e.g. test learner) and confirm they can sign in

---

## 4. Courses

- [ ] **Create course**: add title, description, module, lesson, optional video/reading/quiz → **Save**
- [ ] No “Failed to save course”; success message and course appears in **My Courses**
- [ ] **Publish** a course (so it appears in Learners invite dropdown and for enrollments)
- [ ] **Share course**: copy link, open in incognito; link works (or shows “Open in Coursify” if you add `/course/[id]`)

---

## 5. Invite candidates (live)

- [ ] Go to **Learners** → **Invite Learners**
- [ ] Enter one or more **real email addresses** (use your own for testing)
- [ ] Optionally select a **published course**
- [ ] Submit
- [ ] **Expected**: “Invites saved and emails sent to N recipient(s)” (if `RESEND_API_KEY` is set)
- [ ] **Check inbox**: invite email received with “Open Coursify” link pointing to `NEXT_PUBLIC_APP_URL`
- [ ] If `RESEND_API_KEY` is not set: message should say “Invites saved. Set RESEND_API_KEY to send invite emails.”

---

## 6. Reminder emails (live)

- [ ] In **Learners**, pick a learner who has signed up (so we have a user id). Send **Send Reminder**.
- [ ] **Expected**: “Reminder saved and email sent.” (needs `RESEND_API_KEY` and, for resolving email by user id, `SUPABASE_SERVICE_ROLE_KEY`)
- [ ] **Check learner inbox**: reminder email received with “Go to Coursify” link

---

## 7. Reports

- [ ] **Reports** → Generate report → CSV downloads with real data (enrollments, courses, progress)
- [ ] If using cron: call `GET /api/reports/generate` with `Authorization: Bearer <CRON_SECRET>` (and `CRON_SECRET` set in env)

---

## 8. Other quick checks

- [ ] **Dashboard**: stats load (courses, learners, etc.)
- [ ] **Analytics**: loads without error
- [ ] **Profile**: shows achievements/certificates from enrollments
- [ ] **Account Settings**: delete-account flow works if you use it (requires `SUPABASE_SERVICE_ROLE_KEY`)

---

## 9. Production deploy (e.g. Vercel)

- [ ] All env vars set in Vercel (see DEPLOYMENT.md), including `RESEND_API_KEY` and `NEXT_PUBLIC_APP_URL`
- [ ] Supabase **Redirect URLs** and **Site URL** include production URL
- [ ] Run sections 3–6 again against production URL

---

## Summary

| Area            | Depends on                          | What to verify                    |
|-----------------|-------------------------------------|-----------------------------------|
| Auth            | Supabase URL/keys, redirect URLs    | Sign in, sign out, sign up        |
| Save course     | Supabase, signed-in user            | No “Failed to save course”        |
| Invite + email  | Supabase + `RESEND_API_KEY`         | Invites saved, email received     |
| Reminder email  | Supabase + Resend + service role*    | Reminder saved, email received    |
| Reports         | Supabase, optional CRON_SECRET      | CSV download / cron works         |

\* `SUPABASE_SERVICE_ROLE_KEY` is used to resolve learner email from user id when sending reminders.
