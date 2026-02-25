# Branch and deploy strategy

**Repo:** https://github.com/Raghavendra-Pratap/Coursify-dev.git  
**Branches:** `develop` (testing), `main` (production).

---

## Recommended setup: develop → Vercel, main → your domain

| Branch   | Deploy to        | Purpose                          |
|----------|------------------|-----------------------------------|
| **develop** | Vercel (preview) | Dev/staging: test invites, emails, auth before release |
| **main**    | Your domain     | Production: live site for learners |

**Why this works well**

1. **Develop on Vercel**
   - Every push to `develop` can deploy to a Vercel **preview** URL (e.g. `coursify-dev-xxx.vercel.app`) or a dedicated “staging” project.
   - You get a stable URL for testing (invites, Resend, Supabase redirect URLs) without touching production.
   - Free tier is usually enough for one preview/staging app.

2. **Main to your domain**
   - Only merge to `main` when you’re happy with testing on `develop`.
   - Point your real domain (e.g. `lms.yourcompany.com`) to the **production** deployment (from `main`).
   - Keeps production stable and predictable.

3. **Env vars**
   - **Vercel (develop):** Use a separate Supabase project for staging, or the same project with extra redirect URLs for the Vercel preview URL. Use a separate Resend API key (or same) and set `NEXT_PUBLIC_APP_URL` to the **preview** URL so invite/reminder links are correct.
   - **Production (main):** Use production Supabase + production `NEXT_PUBLIC_APP_URL` = your domain. Add your domain to Supabase redirect URLs and Resend (if you use a custom from-address).

---

## Vercel configuration

1. **One project, two branches**
   - In Vercel: connect the repo `Coursify-dev`.
   - **Production branch:** `main` → deploys to your **production** domain when you add it.
   - **Preview branches:** enable “Preview” for other branches (e.g. `develop`) → each gets a URL like `coursify-dev-git-develop-xxx.vercel.app`.
   - Optional: in **Settings → Git**, set a **custom preview branch** so only `develop` (and maybe PRs) get previews.

2. **Or two Vercel projects**
   - **Project A:** connected to same repo, production branch `main`, domain = your domain.
   - **Project B:** connected to same repo, production branch `develop`, domain = a staging subdomain or default `*.vercel.app` URL.
   - Clear separation; you can use different env vars per project.

---

## Workflow (no push until you’re ready)

1. **Local:** work on `develop`, run `npm run dev` / `npm run build`.
2. **When .gitignore and config are decided:** commit on `develop`, then push when ready:
   ```bash
   git add .
   git commit -m "Initial develop branch"
   git push -u origin develop
   ```
3. **After Vercel is connected:** push to `develop` → preview deploy; test there.
4. **When ready for production:** merge `develop` → `main`, push `main`; then add your domain in Vercel for the production deployment.

---

## Summary

- **Develop branch → Vercel (preview/staging):** good for dev testing (invites, emails, auth) without affecting production.
- **Main → your domain:** good for production; only updated when you merge from `develop`.
- Do **not** push until you’re happy with `.gitignore` and env strategy; then push `develop` first and configure Vercel.
