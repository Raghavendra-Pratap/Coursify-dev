# Remaining placeholders & TODOs

**Scope:** Root app (`components/`, `app/`) and coursify-app. Excludes `sample ui/` (reference only) and input `placeholder` attributes (normal UX).

---

## 1. Config / setup messages (shown when env or backend not set)

These are **intentional**: they tell the user what to configure. Once Supabase is set and tables exist, the features work.

| Location | Message | When shown |
|----------|---------|------------|
| **CoursifyLMS.tsx** | "Sign in to save and publish courses. Configure Supabase in .env.local for persistence." | Sign-in modal when Supabase env missing |
| **Dashboard.tsx** | "Configure Supabase to see real stats." | Banner when `NEXT_PUBLIC_SUPABASE_URL` missing |
| **MyCourses.tsx** | "Configure Supabase (see BACKEND_SETUP.md) to load and save courses." | Banner when env missing |
| **Learners.tsx** | "Configure Supabase to load learners." | Banner when env missing |
| **Learners.tsx** | "Configure Supabase to save reminders." | Send reminder when env missing |
| **Learners.tsx** | "Reminder saved. Configure email service to send actual emails." | After saving reminder (reminder is stored; email not sent) |
| **Analytics.tsx** | "Configure Supabase to see analytics." | Banner when env missing |
| **Reports.tsx** | "Configure Supabase to generate reports." | When generating report with no env |
| **Reports.tsx** | "Schedule saved for \"…\". Configure a cron or worker to send reports." | After saving schedule; cron can call `GET /api/reports/generate` with `Authorization: Bearer <CRON_SECRET>`. |
| **CreateCourse.tsx** | "Demo: marked as published. Configure Supabase and sign in, then Save, to publish for real." | Publish when Supabase not configured |

**Action:** None required for “placeholder” cleanup; these are correct. Optional: add a cron/worker later for report scheduling, and an email provider for reminders.

---

## 2. Empty-state copy (not placeholders)

These are **valid empty states** when there’s no data; they’re not fake features.

| Location | Text |
|----------|------|
| **Profile.tsx** (Certificates tab) | "Complete courses to earn certificates. Your certificates will appear here." (when no completed courses) |
| **LearningPreferences.tsx** | "Preferences will appear here once you complete some content or use the buttons below." |
| **CreateCourse** (preview) | "Add a video to this lesson to see a preview here." / "Add a video to the first lesson to see a preview here." (when no video in first lesson) |
| **CreateCourse** (preview) | "No description." (when course description is empty) |

**Action:** None; these are appropriate.

---

## 3. Code TODOs (unimplemented or partial)

### Root app

| File | TODO | Notes |
|------|------|--------|
| _(none)_ | Reading persistence | Done: `content_type = 'reading'`, `reading_materials` table, CreateCourse save path. |

### coursify-app

| File | TODO | Notes |
|------|------|--------|
| _(none)_ | Seamless segment playback | Done: one segment at a time, `MicroVideoPlayer` `onEnded` auto-advances or marks lesson complete. |
| **CourseForm.tsx** | Temporarily bypassing auth for demo; template application logic | Demo-only; template create-from-template not implemented. |
| **AdminDashboard.tsx** | Excel export; get actual email from users table | Export and user email resolution not implemented. |
| **video-utils.ts** | Google Drive URL resolution; Supabase signed URL; stitching logic; segment replacement | Streaming is timestamp-based (no stitching); Drive/Storage URLs and segment replacement are future work. |
| **GoogleDrivePicker.tsx** | Check Drive connection; OAuth flow; fetch files; playable URL | Drive picker is UI shell; real OAuth/API not wired. |
| **LessonEditor.tsx** | Implement file upload | File upload not implemented. |
| **lib/supabase-server.ts** | Handle cookie setting/removal errors | Error handling in server auth helper. |

---

## 4. Stubs (intentional, not user-facing)

These exist so the **root** app can type-check or reference components that live in **coursify-app**. They are not user-facing placeholders.

- `components/AdminDashboard.tsx` – stub
- `components/CourseCard.tsx` – stub  
- `components/CourseEditor.tsx` – stub
- `components/LearnerView.tsx` – stub
- `components/CourseForm.tsx` – stub  

**Action:** None.

---

## Summary

| Category | Count | Action |
|----------|--------|--------|
| Config/setup messages | 10 | Keep; optional: add cron + email later |
| Empty-state copy | 4 | Keep |
| Code TODOs (root) | 0 | Reading persistence implemented. |
| Code TODOs (coursify-app) | 6+ | Optional: Drive OAuth, upload, etc.; seamless playback done. |
| Stubs | 5 | Keep (dev only) |

**Bottom line:** There are no misleading “fake” features. Remaining items are: (1) correct config/empty-state copy, (2) optional backend (cron, email), (3) optional features (reading persistence, seamless segment playback, Drive, upload), and (4) dev-only stubs.
