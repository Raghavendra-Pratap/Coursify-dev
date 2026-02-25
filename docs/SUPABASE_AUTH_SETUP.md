# Supabase Auth Setup (Google sign-in)

## 1. Fix the Supabase URL (fixes "invalid response")

The browser must hit the **exact** project URL. One character wrong causes "sent an invalid response."

**Correct project URL (no typos):**
```
https://ddzmkeogkytjqmtiyjxf.supabase.co
```

In **root** `.env.local` and **coursify-app** `.env.local`, set:
```env
NEXT_PUBLIC_SUPABASE_URL=https://ddzmkeogkytjqmtiyjxf.supabase.co
```
Check for:
- No extra letters (e.g. `ty` instead of `t`, or `tii` instead of `ti`)
- No missing letters

Then restart the dev server (`npm run dev`).

---

## 2. Authorization Path (`/oauth/consent`)

This path is implemented in the app so Supabase can send users to your consent UI before the provider (Google).

- **Route:** `app/oauth/consent/page.tsx` → serves **http://localhost:3000/oauth/consent**
- Users see a “Sign in to Coursify” screen with “Continue with Google”; clicking it starts the Supabase OAuth flow and redirects back to `/` after sign-in.

No extra config needed if your dashboard’s “Authorization Path” is set to `/oauth/consent`.

---

## 3. Redirect URLs in Supabase

1. Open [Supabase Dashboard](https://app.supabase.com) → your project.
2. Go to **Authentication** → **URL Configuration**.
3. Under **Redirect URLs**, add:
   - `http://localhost:3000`
   - `http://localhost:3000/**`
   - `http://localhost:3000/oauth/consent`
4. Save.

---

## 4. Enable Google provider

1. In the same project: **Authentication** → **Providers**.
2. Enable **Google**.
3. Add your **Google OAuth Client ID** and **Client Secret** from [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
   - Create an OAuth 2.0 Client ID (Web application).
   - **Authorized redirect URIs** must include:
     ```
     https://ddzmkeogkytjqmtiyjxf.supabase.co/auth/v1/callback
     ```
   - Copy Client ID and Client Secret into Supabase Google provider and save.

After this, "Sign in with Google" should work and redirect back to `http://localhost:3000`.

---

## 5. Optional: Profile photo upload (Full profile page)

The profile page lets users change their photo via the camera icon. That uploads to Supabase Storage.

1. In Supabase Dashboard → **Storage**, create a bucket named **`avatars`**.
2. Set the bucket to **Public** (so profile images can be shown without signed URLs).
3. Add a policy so authenticated users can upload: **Storage** → **Policies** → New policy → "Users can upload to their own folder" (e.g. allow `auth.uid()::text` in the path or allow authenticated insert/update for `avatars`).

If the bucket is missing, the camera button will do nothing (upload fails silently).
