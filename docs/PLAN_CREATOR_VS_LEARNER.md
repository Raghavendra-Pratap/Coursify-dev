# Plan: How we show the app to Creator vs Learner

**Goal:** One app, two clear experiences — **Creator** (instructor/admin) and **Learner** — so each role sees the right home and nav without clutter.

---

## 1. Creator (instructor / admin)

**Who:** `user_profiles.role` is `instructor` or `admin`.

**Landing:**  
- Default view = **Dashboard** (stats, top courses, recent activity).

**Sidebar (what they see):**
- Dashboard  
- My Courses (courses they created; create/edit structure)  
- Learners (admin: all users; instructor: only enrolled in their courses)  
- Analytics  
- Reports  
- Profile / Account (via profile modal: Profile, Account Settings, Sign out)

**Mental model:** “I create and manage courses and see who’s learning.”

---

## 2. Learner

**Who:** `user_profiles.role` is `learner` (or not set / default).

**Landing:**  
- Default view = **My learning** (enrolled courses, progress, Continue).

**Sidebar (what they see):**
- **My learning** (enrolled courses, progress %, Continue / Start)  
- **Browse** (optional later: published catalog, self-enroll)  
- Profile / Account (via profile modal: Profile, Account Settings, Sign out)

**Mental model:** “I see my courses and continue learning.”

**What learners don’t see:**  
- Dashboard (instructor stats)  
- My Courses (author’s course list / structure)  
- Create Course  
- Learners (manage list)  
- Analytics  
- Reports  

*(So: no creator-only nav items.)*

---

## 3. Behaviour summary

| Aspect            | Creator (instructor / admin)     | Learner                    |
|------------------|-----------------------------------|----------------------------|
| Default view     | Dashboard                         | My learning                |
| Main nav         | Dashboard, My Courses, Learners, Analytics, Reports | My learning, (optional) Browse |
| Create / manage  | Yes (courses, learners, analytics) | No                        |
| Take courses     | Can still have enrollments; can open “My learning” from profile or a link if we add it later | Yes (My learning → Continue) |

---

## 4. Implementation steps (to “play” with)

**Phase 1 – Role-based default view**
- On load, read `user_profiles.role`.
- If `learner` → set initial `currentView = 'learn'` (My learning).
- If `instructor` or `admin` → set initial `currentView = 'dashboard'`.

**Phase 2 – Role-based sidebar**
- Derive `isCreator = role === 'instructor' || role === 'admin'`.
- In sidebar: if `isCreator`, render Dashboard, My Courses, Learners, Analytics, Reports.
- If not creator (learner), render only: My learning, (optional) Browse, and same profile/account entry.

**Phase 3 – “My learning” view**
- New view key: `learn`.
- Page content: list current user’s **enrollments** (course title, progress %, last accessed).
- Actions: **Continue** / **Start** → open course-taking flow (existing LearnerView or in-root flow).
- Reuse enrollment data already used in Profile so we don’t duplicate logic.

**Phase 4 – Course-taking in root**
- “Continue” / “Start” from My learning must open the real course player (modules → lessons → content, mark complete).
- Options: reuse **coursify-app** LearnerView in root (copy or embed) or implement a minimal in-root “take course” flow against the same Supabase schema.

**Phase 5 (optional) – Learner can open Profile**
- Profile stays available from the profile modal for both roles.
- Learner’s Profile can show “My courses” (enrolled), certificates, settings — no creator-only sections.

---

## 5. Edge cases

- **New user, no role set:** Treat as learner (default view = My learning, learner nav).
- **Admin:** Same as creator (Dashboard, full creator nav); Learners shows all users.
- **Instructor who is also enrolled in a course:** Creator nav by default; “My learning” can be linked from Profile or we add a single “My learning” nav item for creators too so they can switch context.

---

## 6. What we’re not changing (for now)

- Single app (no separate learner subdomain or app).
- Same sign-in; role comes from `user_profiles.role`.
- RLS and backend behaviour stay as-is (creator vs learner visibility already handled on Learners page).

---

## Next step

Pick a phase to implement first (e.g. **Phase 1 + 2** for “right default + right sidebar”), then add **Phase 3** so learners have a real “My learning” page. Phase 4 can follow once we decide where the course-taking UI lives (root vs coursify-app).
