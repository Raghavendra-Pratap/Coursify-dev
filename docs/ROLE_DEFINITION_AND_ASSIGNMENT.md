# How roles are defined and when they’re assigned

**Short answer:** Right now, **every new user is a learner by default**. There is **no built-in flow** that makes someone an instructor or admin; that has to be done manually (e.g. in Supabase) or we add a flow.

---

## 1. Where roles live

- **Table:** `public.user_profiles`
- **Column:** `role` — `TEXT`, allowed values: `'learner' | 'instructor' | 'admin'`
- **Default:** `DEFAULT 'learner'` (so new rows start as learner)

On signup, the trigger `handle_new_user()` inserts a row into `user_profiles` with only `id`, `full_name`, `avatar_url`. It does **not** set `role`, so the **table default applies** → **every new user becomes a learner**.

---

## 2. When does someone have the **learner** role?

| How | When |
|-----|------|
| **Automatic** | New signup (trigger uses table default `role = 'learner'`). |
| **Manual** | An admin sets `user_profiles.role = 'learner'` in Supabase (e.g. after demoting or correcting). |

So: **learner = default for new users**, unless you change it.

---

## 3. When does someone become an **instructor**?

Today there is **no automatic or in-app path**. Options you can choose from:

| Option | When they become instructor | Pros | Cons |
|--------|-----------------------------|------|------|
| **A. Admin assigns** | An admin (or you in Supabase) sets `user_profiles.role = 'instructor'` for that user. | Full control, clear. | Manual; need an “admin” way to do it (SQL or future admin UI). |
| **B. First course creation** | The first time a user creates a course (e.g. clicks Create / saves a course), the app updates their profile to `role = 'instructor'`. | No manual step; “creator” is defined by behavior. | Anyone can self-become instructor; you may not want that. |
| **C. Request + approval** | User clicks “Request instructor access”; an admin approves (e.g. in a simple admin screen or Supabase). | Controlled, auditable. | Requires “request” UI and “approve” flow (and who is admin?). |
| **D. Invite-only instructors** | Only users who signed up via an “instructor invite” link (or were created by an admin as instructor) get `instructor`. | Very controlled. | Need invite flow and possibly separate signup path. |
| **E. Email / domain rule** | e.g. `@company.com` → instructor, others → learner (in trigger or app logic). | Simple for single-tenant. | Fragile; doesn’t fit all cases. |

**Practical suggestion:**  
- Start with **A (admin assigns)** so you can hand-pick instructors.  
- Optionally add **B** later (“first course creation → instructor”) if you’re okay with “anyone who creates a course is an instructor.”

---

## 4. When does someone become **admin**?

- **Today:** Only by **manually** setting `user_profiles.role = 'admin'` in the database (e.g. Supabase SQL or Table Editor).
- **Typical rule:** Only a few people; first admin is often set via a one-off SQL script or seed.

---

## 5. Who can change roles?

- **RLS today:** Users can **update their own** `user_profiles` row, but the table only restricts *that* they can update; it doesn’t restrict *which columns*. So in theory a user could try to set their own `role`.
- **Safer approach:** Restrict `role` so only admins (or the backend with service role) can change it:
  - Option 1: In the app, never send `role` in profile update from the client; only allow updates to `full_name`, `avatar_url`, etc. Role changes only via Supabase (admin) or an API that checks admin.
  - Option 2: Add an RLS policy so `role` can only be updated when `auth.uid()` is in an “admin” list (e.g. from a small `admins` table or a check that the current user’s role is already `admin`). That way only admins can promote/demote.

---

## 6. Summary table

| Role      | How they get it today        | Suggested rule (you choose) |
|-----------|------------------------------|-----------------------------|
| **Learner**   | Default on signup (trigger). | Keep as default for new users. |
| **Instructor**| Not set by app; manual only. | A: Admin assigns. Optional: B on first course creation. |
| **Admin**     | Manual only (DB).            | Set first admin via SQL; only admins can change roles (app + optional RLS). |

---

## 7. Next steps (if you want to implement)

1. **Decide:** “Instructor = admin-assigned only” vs “Instructor = first course creation” vs hybrid.
2. **Harden role changes:** In profile update (e.g. Profile page), do not allow the client to update `role`; only full_name, avatar, etc. Optionally add RLS so only admins can update `role`.
3. **Admin way to set instructor:** Either use Supabase Table Editor / SQL for now, or add a simple “Users” / “Learners” screen for admins with “Set role → Instructor” (and later “Set role → Learner”).
4. **Optional:** “Request instructor” button for learners + simple admin approval list (later).

Once you decide “we want instructor = admin-assigned” (or “= first course creation”), we can wire the UI and any one-off “set first admin” SQL accordingly.
