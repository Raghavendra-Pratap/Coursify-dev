# Learner view: findings and options

**Problem:** When people land on the app, everyone sees the **instructor/author** experience (Dashboard, My Courses, Create Course, Learners, Analytics, Reports). There is no dedicated **learner view** where someone who only takes courses lands and sees “My learning” / “Continue” / “Browse catalog” instead of “Create course” and course management.

---

## Current state

### Root app (`components/`, single SPA via `CoursifyLMS.tsx`)

| What | Details |
|------|--------|
| **Entry** | Everyone lands on the same shell: sidebar + main area. Default view is **Dashboard** (instructor-style stats). |
| **Sidebar** | Same for all users: Dashboard, My Courses (author’s courses), Create Course, Learners (manage learners), Analytics, Reports, Settings. No “My learning” or “Enrolled courses”. |
| **Role** | `user_profiles.role` is loaded (`learner` \| `instructor` \| `admin`) and shown in the profile footer as a label only. **Role does not change the default view or the sidebar.** |
| **Learner data** | Profile page already loads the signed-in user’s **enrollments** and shows “My courses” (enrolled) and certificates — but that’s inside Profile, not a first-class learner home. |
| **Taking a course** | Root has only a **stub** `LearnerView` (shows `courseId`). The real “take course” UI (modules, lessons, video segments, mark complete) lives in **coursify-app** (`coursify-app/components/LearnerView.tsx`). |

### coursify-app

- Has the real **LearnerView** (course content, modules/lessons, MicroVideoPlayer, mark complete).
- Handoff doc says develop/release from coursify-app; root is reference/prototype.
- “Learner enrollment flow needs completion” is still in the README.

**Conclusion:** The app is author-first. Learners have no dedicated landing or mode; role is displayed but not used to switch experience.

---

## Options

### A. Add a “My learning” view in the root app (recommended baseline)

- Add a new view, e.g. **“My learning”** (or “Enrolled”), to the sidebar.
- **Content:** List the current user’s enrollments (same data as Profile’s courses tab): course title, progress %, “Continue” / “Start”.
- **Click “Continue”** → open the **real** learner experience for that course. That means either:
  - **A1.** Embed or reuse **coursify-app’s LearnerView** in the root app (e.g. copy component + deps into root, or mount coursify-app in an iframe / micro-frontend), or  
  - **A2.** Implement a minimal “take course” flow in root (course → modules → lessons → content) using the same Supabase schema, so learners never need to switch app.

**Result:** Learners have a clear first-class entry: “My learning” with enrolled courses and a path to continue. Authors still see Dashboard / Create / etc.; you can optionally default learners to “My learning” instead of Dashboard.

### B. Role-based default view and sidebar

- **Default view:** If `user_profiles.role === 'learner'` → default to “My learning”; else → Dashboard.
- **Sidebar:** For learners, show only (or emphasize): My learning, Profile, Settings. Hide or de-emphasize Create Course, Learners (manage), Analytics, Reports.
- **Instructors/admins:** Keep full sidebar and Dashboard default.

**Result:** Learners land in learner mode and see a reduced nav; authors land in author mode. Requires a stable notion of “learner” (e.g. role set at signup or by admin).

### C. Separate URL for learner experience (e.g. `/learn`)

- **Route:** e.g. `/learn` or `/my-learning` (if you add Next.js routes) or a view key `learn` in the SPA.
- **Landing:** “My learning” page: enrolled courses, continue, browse catalog (if you add one).
- **Taking a course:** Same as A: either reuse coursify-app LearnerView or reimplement in root.

**Result:** You can send learners to `yourapp.com/learn` (or “My learning” in the app) and instructors to the main app. Good for shared links and clear separation.

### D. Consolidate on coursify-app and add learner home there

- Treat **coursify-app** as the single app.
- Add a **learner home** page there (enrolled courses, continue, browse).
- Author experience: dashboard, courses, create, learners, analytics (port from root as needed).
- Use role or route so learners land on learner home; authors land on dashboard.

**Result:** One codebase, one entry; learner vs author is clear by URL or role. Aligns with “release from coursify-app” but requires consolidation work.

---

## Recommendation

1. **Short term (root app):**  
   - Add a **“My learning”** view that lists the current user’s enrollments (course title, progress, Continue).  
   - Wire **Continue** to the actual course-taking experience: either reuse **coursify-app’s LearnerView** in root (e.g. by copying the component and its dependencies into root) or add a minimal in-root “take course” flow that uses the same schema.  
   - Optionally: if `role === 'learner'`, default to “My learning” and trim sidebar (B).

2. **Medium term:**  
   - If you want a single product, move toward **D** (one app in coursify-app with both learner home and author tools) or keep root and make “My learning” + LearnerView the canonical learner path (A + B + C in root).

3. **Schema / auth:**  
   - You already have `user_profiles.role` and enrollments. No DB change required for “My learning” list or role-based default; only for any future “browse catalog” (e.g. list published courses and self-enroll).

---

## Summary table

| Gap | Current | Suggested |
|-----|--------|-----------|
| Learner landing | None; everyone sees author Dashboard | Add “My learning” view (enrolled courses + Continue) |
| Role usage | Display only | Optional: default view + sidebar by role |
| Taking a course in root | Stub only | Reuse coursify-app LearnerView in root or reimplement minimal flow in root |
| Separate learner URL | No | Optional: `/learn` or “My learning” as first-class view |

If you tell me which option you prefer (A only, A+B, or A+B+C in root, or D in coursify-app), I can outline concrete implementation steps (components, state, and wiring) next.
