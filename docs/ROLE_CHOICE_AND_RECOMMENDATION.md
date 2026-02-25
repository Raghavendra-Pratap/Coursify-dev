# Your two options: default instructor + invite = learner, and sign-in choice

You asked about:

1. **Default new user = instructor;** when someone is invited to a course they become **learner**.
2. **Two options at sign-in:** "Sign in as Instructor" | "Sign in as Learner" — so one email can be used as both.

Here are honest thoughts and a concrete recommendation.

---

## Option A: Default instructor, invited = learner

**Rule:** New signup (on main site) → `role = 'instructor'`. When someone signs up via a **course invite link** (or accepts an invite), set `role = 'learner'`.

**Pros**
- Clear story: "Creators sign up; people they invite are learners."
- Fits a product where only course creators use open signup and everyone else joins via invite.

**Cons**
- If **anyone** can sign up (e.g. public landing page), defaulting to instructor means every new account gets creator tools (Dashboard, Create Course, Learners, etc.). That’s usually wrong — in most LMSs the majority of signups are learners.
- So this works best when signup is **controlled** (e.g. only known creators sign up) and learners only appear through course invites.

**Invited = learner:** When we send a course invite and the person clicks the link and signs up, we set their `user_profiles.role = 'learner'`. That keeps a clean split: signed up on their own → instructor; signed up via invite → learner.

---

## Option B: Two options at sign-in — "Sign in as Instructor" | "Sign in as Learner"

**Rule:** Same email, same account. At sign-in (or right after), the user chooses **Open as Instructor** or **Open as Learner**. The app uses that choice for the session (sidebar, default view, etc.).

**Pros**
- **One email can be both.** Someone who teaches one course and takes another can choose the right mode each time.
- Clear UX: two big buttons, no confusion about "which app" they’re in.
- No need to force "one role per account forever."

**Cons**
- You need to store "session mode" (e.g. in localStorage or Supabase user_metadata) and use it for nav and default view.
- `user_profiles.role` can still exist as "default mode" or "how they were created"; the session choice can override it for the current visit.

---

## Recommendation: use both

1. **Default new user = instructor only if signup is controlled.**  
   If signup is open to everyone, default to **learner** so random signups don’t get creator tools. If only creators sign up and everyone else comes via invite, then **default instructor** is fine.

2. **Invited users = learner.**  
   When someone signs up via a **course invite link**, set `user_profiles.role = 'learner'`. When someone signs up on the main site (no invite), use your default (instructor if you want that and signup is controlled).

3. **Two options at sign-in (or right after).**  
   After email/password (and optional signup), show:
   - **"Open as Instructor"** — creator experience (Dashboard, My Courses, Learners, etc.)
   - **"Open as Learner"** — learner experience (My learning, etc.)

   Store the choice in **localStorage** (e.g. `coursify_session_mode: 'instructor' | 'learner'`) and use it for sidebar and default view. Optionally save the last choice to `user_profiles.role` or `user_metadata` so next time you can default to it.  
   Result: **one email can be both instructor and learner**; they pick which experience they want for this session.

4. **Summary**
   - **Profile role** = how they were created: invite → learner; open signup → instructor (or learner, by your rule).
   - **Session mode** = what they chose at sign-in. App uses session mode for UI; same account can choose the other mode next time they sign in.

---

## One-email, two-roles

With the sign-in choice, one email is both:
- **Instructor** when they pick "Open as Instructor" (create courses, manage learners, see Dashboard).
- **Learner** when they pick "Open as Learner" (see My learning, continue enrolled courses).

No need for two accounts; the role is effectively "which experience do I want right now?"

---

## If you want to implement

1. **Default:** New signup (no invite) → `role = 'instructor'` (change DB default or trigger). Invite signup → set `role = 'learner'` when they complete signup from invite link.
2. **Sign-in page:** After successful auth, show "Open as Instructor" | "Open as Learner"; store in localStorage (and optionally in profile/metadata).
3. **App shell:** Read session mode from localStorage (or profile) and show creator sidebar vs learner sidebar and set default view accordingly.
4. **Profile role:** Either keep as "default mode" for next sign-in, or leave as "how they were created"; session mode overrides for the current session.

This gives you clear roles (instructor vs learner) and still allows one email to be used both ways.
