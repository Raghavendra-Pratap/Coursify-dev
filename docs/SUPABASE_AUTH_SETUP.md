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

4. **Redirect URLs (required for OAuth):** In Supabase → **Authentication** → **URL Configuration**, add your app URLs to **Redirect URLs** so Supabase can send users back after sign-in:
   - Local: `http://localhost:3000/auth/callback`
   - Vercel/preview: `https://coursify-dev.vercel.app/auth/callback` (or your preview URL)
   - Production: `https://yourdomain.com/auth/callback`
   Set **Site URL** to your main app URL (e.g. `https://coursify-dev.vercel.app`). Without these, you may stay stuck on the login page after "Sign in with Google".

---

## 5. Optional: Profile photo upload (Full profile page)

The profile page lets users change their photo via the camera icon. That uploads to Supabase Storage.

1. In Supabase Dashboard → **Storage**, create a bucket named **`avatars`**.
2. Set the bucket to **Public** (so profile images can be shown without signed URLs).
3. Add a policy so authenticated users can upload: **Storage** → **Policies** → New policy → "Users can upload to their own folder" (e.g. allow `auth.uid()::text` in the path or allow authenticated insert/update for `avatars`).

If the bucket is missing, the camera button will do nothing (upload fails silently).

---

## 6. Masking the Supabase domain (“Choose an account to continue to …”)

When users sign in with Google, they see **“Choose an account to continue to ddzmkeogkytjqmtiyjxf.supabase.co”**. That domain is your Supabase project URL. You can replace it with a friendlier name in two ways:

### Option A: Vanity subdomain (e.g. `coursify.supabase.co`)

You get a readable subdomain on `supabase.co` instead of the random project ID.

- **Result:** Users see “Continue to **coursify**.supabase.co” (or whatever name you choose).
- **How:** Supabase Dashboard → **Project Settings** → **General** (or **API**) and look for **Vanity subdomain** / **Custom subdomain**. If available, set a subdomain (e.g. `coursify`).
- **Or via CLI:** Install [Supabase CLI](https://supabase.com/docs/reference/cli/introduction), run `supabase login`, then:
  ```bash
  supabase vanity-subdomains activate --project-ref ddzmkeogkytjqmtiyjxf --vanity-subdomain coursify
  ```
- **After activating:** Supabase will give you a new URL (e.g. `https://coursify.supabase.co`). Update `.env.local` and Vercel env vars:
  - `NEXT_PUBLIC_SUPABASE_URL=https://coursify.supabase.co`
  In **Google Cloud Console** → your OAuth client → **Authorized redirect URIs**, change the callback to:
  - `https://coursify.supabase.co/auth/v1/callback`
  In **Supabase** → **Authentication** → **URL Configuration**, the Site URL and redirects will use the new host automatically once the project URL is updated.

**Note:** Vanity subdomain is a [Beta] feature; it may be in Dashboard under **Settings** or only via CLI/API. Check [Supabase docs](https://supabase.com/docs/reference/cli/supabase-vanity-subdomains-activate) for the latest.

### Option B: Custom domain (e.g. `auth.yourdomain.com`)

You use your own domain for the API/Auth endpoint so users see your brand.

- **Result:** Users see “Continue to **auth.yourdomain.com**”.
- **How:** Supabase supports a **custom hostname** for the project (Beta, via Dashboard or [Management API](https://supabase.com/docs/reference/api/v1-activate-custom-hostname)). You add a custom domain (e.g. `api.yourdomain.com` or `auth.yourdomain.com`), verify ownership via DNS (TXT/CNAME as Supabase instructs), then Supabase provisions SSL.
- **After it’s active:** Use that URL as `NEXT_PUBLIC_SUPABASE_URL` and set the Google OAuth redirect URI to `https://auth.yourdomain.com/auth/v1/callback` (or whatever host you chose).

**Summary:** For a quick improvement, try **Option A (vanity subdomain)** so the consent screen shows e.g. `coursify.supabase.co` instead of the project ID. For a fully branded experience, use **Option B (custom domain)** once you have a domain and DNS access.
