# Secrets and key rotation

If Vercel warns that `SUPABASE_SERVICE_ROLE_KEY` is visible to team members, or if a key may have been exposed, follow this checklist.

## What the warning means

Vercel flags env vars that **look like secrets** but are not marked **Sensitive**. Anyone with access to the Vercel project can read non-sensitive values in the dashboard.

The service role key is **never** sent to browsers in this app (`lib/supabase-admin.ts` is `server-only`). It only runs in API routes on Vercel.

---

## 1. Rotate the key in Supabase (do this if anyone saw the old value)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. **Project Settings** → **API**.
3. Under **Project API keys**, use **Generate new secret** / rotate JWT secret (wording varies by Supabase version).
   - This invalidates the current `anon` and `service_role` keys and issues new ones.
4. Copy the new **service_role** key (not the anon key).
5. Copy the new **anon** key if it changed — update `NEXT_PUBLIC_SUPABASE_ANON_KEY` if needed.

> After rotation, old keys stop working immediately. Update Vercel and local `.env.local` before redeploying.

---

## 2. Update Vercel (mark as Sensitive)

1. Vercel → your project → **Settings** → **Environment Variables**.
2. **Delete** the existing `SUPABASE_SERVICE_ROLE_KEY` entry (Production, Preview, Development as applicable).
3. **Add** it again:
   - Name: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: paste the **new** service_role key from Supabase
   - Enable **Sensitive** ( hides value after save )
   - Apply to Production + Preview (and Development if you use it)
4. **Redeploy** the latest `develop` deployment (Deployments → … → Redeploy).

CLI alternative:

```bash
vercel env rm SUPABASE_SERVICE_ROLE_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production --sensitive
# paste new key when prompted
```

---

## 3. Update local dev

```bash
# .env.local — never commit this file
SUPABASE_SERVICE_ROLE_KEY=<new_service_role_key>
```

Restart `npm run dev`.

---

## 4. Verify

- [ ] Vercel security warning cleared (or key marked Sensitive)
- [ ] App loads at https://coursify.bsoc.space
- [ ] Learners page loads (uses service role on server)
- [ ] Create/save course works
- [ ] Learner enroll / progress works

---

## Rules for this repo

| Variable | Client-safe? | Where to set |
|----------|--------------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Vercel, `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes (public, RLS-protected) | Vercel, `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | **No — server only** | Vercel (**Sensitive**), `.env.local` only |
| `RESEND_API_KEY` | **No** | Vercel (**Sensitive**) |
| `MAGIC_LINK_SECRET` | **No** | Vercel (**Sensitive**) |

**Never** prefix server secrets with `NEXT_PUBLIC_`.

**Never** commit `.env.local`, `.env.production`, or real keys to git.

Admin DB access: `import { createServerClient } from '@/lib/supabase-admin'` (not `@/lib/supabase`).

---

## If the key was committed to git

1. Rotate in Supabase (step 1) — rotation is mandatory.
2. Remove the secret from history (e.g. `git filter-repo` or GitHub secret scanning follow-up).
3. Ensure `.env*` and `.env.production` stay in `.gitignore`.

Search the repo: `git log -p --all -S 'eyJ' -- '*.env*'` (JWT keys often start with `eyJ`).
