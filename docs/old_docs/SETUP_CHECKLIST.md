# Coursify LMS – Setup Checklist

Use this checklist to confirm your environment is ready to run and persist data. **To deploy to the web**, see [DEPLOYMENT.md](DEPLOYMENT.md).

---

## 1. Environment variables (.env.local)

Your `.env.local` should have at least:

| Variable | Purpose | Your status |
|----------|---------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public/anonymous key for client | Set |
| `NEXT_PUBLIC_APP_URL` | App URL (e.g. `http://localhost:3000`) | Set |

Optional:

- `SUPABASE_SERVICE_ROLE_KEY` – server-side only; never expose to the client.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` – only if you use Google Drive OAuth (currently commented out in the app).

**Check:** `.env.local` is in `.gitignore` so secrets are not committed.

---

## 2. Database schema (Supabase)

Tables must exist in your Supabase project.

1. Open [Supabase Dashboard](https://app.supabase.com) → your project.
2. Go to **SQL Editor** → **New query**.
3. Copy the **entire** contents of `database/schema.sql` from this repo.
4. Paste into the editor and click **Run**.
5. Confirm there are no errors (tables and RLS policies are created).

**Verify:** In **Table Editor**, you should see tables such as: `courses`, `modules`, `lessons`, `content_items`, `video_segments`, `quizzes`, `user_profiles`, `learner_preferences`, `learner_activity`, etc.

**If you use “external URL” video links:** The default schema only allows `upload`, `google_drive`, `youtube`. To allow `external_url`, run this once in the SQL Editor:

```sql
ALTER TABLE video_segments
  DROP CONSTRAINT IF EXISTS video_segments_source_check;
ALTER TABLE video_segments
  ADD CONSTRAINT video_segments_source_check
  CHECK (source IN ('upload', 'google_drive', 'youtube', 'external_url'));
```

---

## 3. Authentication (Supabase)

1. In Supabase: **Authentication** → **Providers**.
2. **Email** – ensure it is **Enabled** (default).
3. (Optional) **Google** – enable if you use “Sign in with Google”:
   - Add your Google OAuth client ID/secret in Supabase.
   - In **Authentication** → **URL Configuration**, add:
     - `http://localhost:3000` (and your production URL when you deploy).

**Verify:** Create a test user under **Authentication** → **Users** (e.g. “Add user” with email + password), then sign in from the app.

---

## 4. Install and run the app

```bash
# From the project root (e.g. Coursify)
npm install
npm run dev
```

Open `http://localhost:3000` (or the URL shown in the terminal).

**Verify:**

- No “Supabase configuration missing” warning in the browser console.
- Sidebar shows **Sign In** when not logged in.
- After signing in, **Save Changes** and **Publish Course** on Create Course work (course is stored in Supabase).

---

## 5. Quick verification flow

1. **Sign in** – use the **Sign In** button in the sidebar (email/password or Google if configured).
2. **Create course** – go to **Create Course**, add a module and lesson, add a video (e.g. YouTube URL), set timestamps.
3. **Save** – click **Save Changes**; you should see a success message and “Last edited” update.
4. **Publish** – click **Publish Course**; status should change to published.
5. **Preview** – click **Preview**; you should see the course title, module count, and total duration (no “NaN”), and the first video if you added one.

If any step fails, check the browser console and the Supabase **Logs** (e.g. API and Auth) for errors.

---

## Summary

| Step | Action | Done? |
|------|--------|--------|
| 1 | `.env.local` has Supabase URL and anon key | ✓ (you have values set) |
| 2 | Run `database/schema.sql` in Supabase SQL Editor | ⬜ |
| 2b | (Optional) Allow `external_url` for video segments | ⬜ |
| 3 | Enable Email (and optionally Google) auth in Supabase | ⬜ |
| 4 | `npm install` and `npm run dev` | ⬜ |
| 5 | Sign in → Create course → Save → Publish → Preview | ⬜ |

Once steps 2–5 are done, your setup is complete for development.
