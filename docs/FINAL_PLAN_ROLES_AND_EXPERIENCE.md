# Final plan: roles and creator vs learner experience

This is the single reference for how roles work and how the app is shown to creators and learners.

---

## 1. Roles: how they are set

| Role | When |
|------|------|
| **Learner** | (1) User signs up via a **course invite link** → set `user_profiles.role = 'learner'`. (2) Or default for new signups if you choose that. |
| **Instructor** | (1) User signs up on the **main site** (no invite) → set `user_profiles.role = 'instructor'` (default for open signup). (2) Or keep current default `learner` and only promote to instructor when they use "Open as Instructor" (see below). |
| **Admin** | Set manually in DB (Supabase). Only admins can change other users’ roles (enforced in app + optional RLS). |

**Database:** `user_profiles.role` — values: `'learner' | 'instructor' | 'admin'`. New row from trigger can use table default (e.g. `'instructor'` if we change it) or we set role in app when they sign up (invite path → learner; main signup → instructor).

---

## 2. Sign-in: one email, two modes

After the user signs in (email/password or OAuth), show two options:

- **Open as Instructor** — creator experience (Dashboard, My Courses, Learners, Analytics, Reports).
- **Open as Learner** — learner experience (My learning, Profile/Settings).

**Storage:** Save the choice in **localStorage** (e.g. `coursify_session_mode: 'instructor' | 'learner'`). Use this for the **current session** to decide sidebar and default view. Optionally save last choice to `user_profiles.role` or `user_metadata` so next sign-in can default to it.

**Result:** One account can be used as both instructor and learner; they choose which experience they want each time they sign in.

---

## 3. What creators see (instructor mode)

- **Default view:** Dashboard (stats, top courses, recent activity).
- **Sidebar:** Dashboard, My Courses, Learners, Analytics, Reports. Profile/Account (and Sign out) via profile area.
- **Access:** Create and edit courses, manage learners (admin: all users; instructor: only enrolled in their courses), view analytics and reports.

---

## 4. What learners see (learner mode)

- **Default view:** My learning (enrolled courses, progress %, Continue / Start).
- **Sidebar:** My learning; optional Browse (later); Profile/Account (and Sign out) via profile area.
- **No access to:** Dashboard, My Courses (author list), Create Course, Learners (manage), Analytics, Reports.

---

## 5. Implementation order

| Phase | What |
|-------|------|
| **1** | **Role at signup** — Invite signup → set `role = 'learner'`. Main signup → set `role = 'instructor'` (or keep `learner` and rely on session mode only). |
| **2** | **Sign-in choice** — After auth, show "Open as Instructor" / "Open as Learner"; store in localStorage; read it in app shell. |
| **3** | **Role-based sidebar and default view** — If session mode = instructor (or profile role is instructor/admin) → creator sidebar + default Dashboard. If session mode = learner (or profile role = learner) → learner sidebar + default My learning. |
| **4** | **My learning view** — New page: list enrollments (course title, progress %, Continue/Start). Wire Continue/Start to course-taking flow. |
| **5** | **Course-taking** — Ensure "Continue" from My learning opens the real course player (modules → lessons → content, mark complete). |
| **6** | **Harden role** — Profile update must not allow client to change `role`; only admins (or backend) can. Optional: RLS so only admins can update `role`. |

---

## 6. Decisions summary

- **Default new user:** Instructor when they sign up on the main site; learner when they sign up via course invite.
- **One email, two modes:** Sign-in choice "Open as Instructor" | "Open as Learner" stored in session (localStorage); app uses it for nav and default view.
- **Creator experience:** Dashboard, My Courses, Learners, Analytics, Reports.
- **Learner experience:** My learning (enrolled courses + Continue), Profile/Settings only.
- **Admin:** Manually set in DB; only admins can change roles.

---

## 7. Related docs

- **PLAN_CREATOR_VS_LEARNER.md** — Detailed creator vs learner UI and phases.
- **ROLE_DEFINITION_AND_ASSIGNMENT.md** — Where roles live, who can change them, RLS.
- **ROLE_CHOICE_AND_RECOMMENDATION.md** — Rationale for default instructor, invite = learner, and sign-in choice.
