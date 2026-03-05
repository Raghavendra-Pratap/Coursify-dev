# Dev-only demo credentials

**Use only on your local dev server (localhost) and with a development Supabase project. Never use in production.**

---

## Option A: Create demo user via script (recommended)

1. Ensure `.env.local` has:
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API → service_role)

2. Optional: set a custom demo email/password (if not set, script uses the defaults below):
   ```bash
   DEMO_USER_EMAIL=demo@example.com
   DEMO_USER_PASSWORD=YourSecureDevPassword123!
   ```

3. From project root, run:
   ```bash
   node scripts/create-demo-user.mjs
   ```

4. Sign in at http://localhost:3000 with:
   - **Email:** `demo@example.com` (or your `DEMO_USER_EMAIL`)
   - **Password:** whatever you set as `DEMO_USER_PASSWORD`, or the default printed by the script.

   If you previously used `demo@coursify.local` and get "Invalid login credentials", run the script again — it now uses `demo@example.com` by default and will create that user (or reset the password if the user already exists).

The script creates the user in Supabase Auth and ensures a `user_profiles` row with **instructor** role so you can access Dashboard, My Courses, Create Course, etc.

---

## Option B: Create demo user manually in Supabase

1. Supabase Dashboard → **Authentication** → **Users** → **Add user**.
2. Create user with:
   - **Email:** `demo@example.com` (or any email you prefer; avoid `.local` — some auth setups reject it)
   - **Password:** choose a password (e.g. `DemoDev123!`)
3. Copy the user’s **UUID** (from the Users table).
4. Ensure they have a profile with **instructor** (or **admin**) role:
   - **Table Editor** → `user_profiles` → **Insert row** (or edit existing):
     - `id` = the user’s UUID
     - `full_name` = e.g. `Demo Instructor`
     - `role` = `instructor` or `admin`

If your project has a trigger that creates `user_profiles` on signup, just update that row’s `role` to `instructor` or `admin`.

---

## Default demo credentials (when using script default)

| Field    | Value                |
|----------|----------------------|
| Email    | `demo@example.com`   |
| Password | `DemoDev123!`        |

**Reminder:** Change the password in production or do not create this user in a production project. Use a separate Supabase project for local development.
