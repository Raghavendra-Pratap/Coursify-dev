# Deploy Coursify LMS to the Web

This guide gets the app from your machine to a live website. Supabase stays as your backend; you only deploy the Next.js frontend.

**Why Vercel appears first:** Vercel is the most common recommendation for Next.js because: (1) same company as Next.js, so zero-config deploy and API routes work out of the box; (2) free tier for hobby projects; (3) custom domain and env vars are simple. It’s **not required**. You can deploy on **Hostinger** (e.g. a subdomain on your existing domain), Netlify, Railway, or any host that runs Node.js. See [§7 Hostinger (subdomain)](#7-hostinger-subdomain) for your case.

---

## Prerequisites

- [x] Supabase project created
- [x] Database schema applied (`database/schema.sql` run in Supabase SQL Editor)
- [x] App runs locally with `npm run dev` and `.env.local` set

---

## 1. Supabase: Add production URL for Auth

Supabase Auth must allow redirects to your **production** URL.

1. Open [Supabase Dashboard](https://app.supabase.com) → your project.
2. Go to **Authentication** → **URL Configuration**.
3. Under **Redirect URLs**, add:
   - `https://your-domain.com/**` (replace with your real domain, e.g. `https://coursify.vercel.app/**`)
   - If you use a custom domain later, add that too, e.g. `https://lms.yourcompany.com/**`
4. Set **Site URL** to your production URL (e.g. `https://coursify.vercel.app`) when you’re ready to go live.
5. Save.

Without this, sign-in and sign-up will fail in production after redirect.

---

## 2. Environment variables for production

Your app needs these at **build and runtime** in production:

| Variable | Required | Where to get it | Notes |
|----------|----------|-----------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase → Settings → API → Project URL | Same as local |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase → Settings → API → anon public | Same as local |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | Supabase → Settings → API → service_role | Only for server-side (e.g. delete-account API). **Never** expose to client. |
| `NEXT_PUBLIC_APP_URL` | Recommended | Your production URL | e.g. `https://coursify.vercel.app` |

Optional (only if you use them):

- `CRON_SECRET` — secret for scheduled report generation: call `GET /api/reports/generate` with `Authorization: Bearer <CRON_SECRET>` or header `x-cron-secret: <CRON_SECRET>`. If set, requests without it return 401.
- `RESEND_API_KEY` — for **invite** and **reminder** emails. Get from [Resend](https://resend.com). Without it, invites/reminders are saved to DB but no email is sent.
- `RESEND_FROM_EMAIL` — optional; e.g. `Coursify <notifications@yourdomain.com>` after verifying domain in Resend. Defaults to `onboarding@resend.dev` for testing.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` — set redirect URI to your production URL (e.g. `https://your-domain.com/auth/drive-callback`).

Use `env.template` as a checklist; copy those into your host’s environment (e.g. Vercel Environment Variables). **Live testing (invites, emails, auth):** see **docs/LIVE_TESTING_CHECKLIST.md**.

---

## 3. Deploy on Vercel

### One-time: Connect repo

1. Push your code to GitHub / GitLab / Bitbucket (if you haven’t already).
2. Go to [vercel.com](https://vercel.com) and sign in (e.g. with GitHub).
3. Click **Add New** → **Project**.
4. Import your Coursify repo. **Root Directory** should be the repo root (where `package.json` and `next.config.js` live).
5. **Framework Preset**: Vercel should detect Next.js. Leave **Build Command** as `npm run build` (or `next build`).
6. **Install Command**: `npm install` (default).

### Set environment variables

1. In the import screen (or later: Project → **Settings** → **Environment Variables**), add:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL  
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key  
   - `NEXT_PUBLIC_APP_URL` = `https://your-vercel-app.vercel.app` (you can change after first deploy)
   - (Optional) `SUPABASE_SERVICE_ROLE_KEY` for server-side APIs
2. Apply to **Production** (and optionally Preview if you want).
3. Deploy. Vercel will run `npm install` and `npm run build` and then serve the app.

### After first deploy

1. Copy your Vercel URL (e.g. `https://coursify-xxx.vercel.app`).
2. In Supabase **Authentication** → **URL Configuration**, add this URL to **Redirect URLs** and set **Site URL** if you want.
3. In Vercel **Settings** → **Environment Variables**, set `NEXT_PUBLIC_APP_URL` to that URL (and update after adding a custom domain).

### Custom domain (optional)

1. In Vercel: Project → **Settings** → **Domains** → Add your domain.
2. Add the same domain (e.g. `https://lms.yourcompany.com/**`) to Supabase **Redirect URLs** and update **Site URL** and `NEXT_PUBLIC_APP_URL` if needed.

---

## 4. Verify deployment

1. Open your live URL. You should see the Coursify UI (dashboard or sign-in).
2. Sign up / Sign in. If it fails, check Supabase **Redirect URLs** and **Site URL**.
3. Create a course, add a module/lesson/video link, **Save** and **Publish**. Check Supabase **Table Editor** for new rows in `courses`, `modules`, `lessons`, `content_items`, `video_segments`.
4. If you use the delete-account API, ensure `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel (and only in server env, not client).
5. **Invites and emails:** Set `RESEND_API_KEY` (and optionally `RESEND_FROM_EMAIL`). Then use **Learners → Invite Learners** and **Send Reminder**; confirm emails are received. See **docs/LIVE_TESTING_CHECKLIST.md** for the full testing list.

---

## 5. Build and run locally (production mode)

To simulate production before deploying:

```bash
npm install
npm run build
npm run start
```

Open `http://localhost:3000`. Fix any build errors before deploying.

**Node version:** Supabase recommends Node.js 20+. On Vercel, set **Settings → General → Node.js Version** to `20.x` if you see a deprecation warning.

---

## 6. Other hosts (Netlify, Railway, etc.)

- **Netlify**: Use “Next.js” or “Next.js (runtime)” and set the same env vars. Build command: `npm run build`; publish directory: `.next` (Netlify usually detects Next.js).
- **Railway / Render / Fly**: Set **Build** to `npm install && npm run build` and **Start** to `npm run start`. Add the same environment variables. Add your production URL to Supabase Redirect URLs.

---

## 7. Hostinger (subdomain)

Yes, you can run Coursify on a Hostinger subdomain (e.g. `lms.yourdomain.com` or `coursify.yourdomain.com`). You need a place that runs **Node.js**; then point the subdomain to that app.

### Option A: Hostinger VPS (recommended for full control)

1. **VPS** – Use a Hostinger VPS plan (e.g. KVM with Node.js support). You get a public IP and root/SSH access.
2. **Server setup** – SSH in, install Node.js 20+ (e.g. via NVM), clone your repo, then:
   ```bash
   npm install
   npm run build
   npm run start   # or use PM2: pm2 start npm --name "coursify" -- start
   ```
3. **Reverse proxy** – Install Nginx (or Caddy), proxy `http://your-server-ip:3000` (or your chosen port) so that Nginx handles the subdomain and SSL.
4. **Subdomain** – In Hostinger (or your DNS):
   - Add an **A record**: subdomain (e.g. `lms`) → your VPS IP.
   - Or use Hostinger’s “Subdomains” and point it to the same VPS (if your domain is on Hostinger).
5. **SSL** – Use Let’s Encrypt (e.g. `certbot` with Nginx) so the subdomain is `https://lms.yourdomain.com`.
6. **Env** – Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL` (e.g. `https://lms.yourdomain.com`) and optional `SUPABASE_SERVICE_ROLE_KEY` in the environment (e.g. in a `.env` file or PM2 ecosystem file; never commit secrets).
7. **Supabase** – In **Authentication → URL Configuration**, add `https://lms.yourdomain.com/**` to Redirect URLs and set Site URL to `https://lms.yourdomain.com`.

### Option B: Hostinger “Node.js” / application hosting (if available)

If your Hostinger account has a **Node.js** or “Application” hosting option (separate from shared hosting):

1. Connect via **GitHub** (or upload a ZIP with `package.json`, no `node_modules`).
2. Set **Build** to `npm install && npm run build` and **Start** to `npm run start` (or the command Hostinger provides).
3. Add the same environment variables in the Hostinger panel.
4. In DNS / Hostinger, point your **subdomain** to this Node.js application (Hostinger will show you the target, e.g. a hostname or IP).
5. Add that subdomain URL to Supabase Redirect URLs and Site URL as above.

### Option C: Shared hosting only

Standard shared hosting (cPanel, PHP-only) does **not** run Node.js. You’d need at least a VPS or Hostinger’s Node.js product to run Next.js. If you only have shared hosting, use Option A (VPS) or deploy elsewhere (e.g. Vercel) and point your Hostinger subdomain to that host (CNAME), or use Hostinger only for the domain/DNS.

### Summary for Hostinger + subdomain

| Step | Action |
|------|--------|
| 1 | Have Node.js running (VPS or Node.js hosting). |
| 2 | Build: `npm run build`; run: `npm run start` (or PM2). |
| 3 | Point subdomain (A record or CNAME) to that server. |
| 4 | Enable HTTPS on the subdomain. |
| 5 | Set env vars; add `https://your-subdomain.yourdomain.com/**` to Supabase Redirect URLs and Site URL. |

---

## 8. Vercel vs Hostinger Node.js: pros and cons

If your Hostinger plan includes **Node.js / application hosting**, here’s a concise comparison so you can choose.

| Aspect | Vercel | Hostinger Node.js |
|--------|--------|-------------------|
| **Setup** | Connect repo → add env vars → deploy. No server config. | Connect GitHub or upload ZIP; set build/start commands and env vars in panel. Usually a bit more steps than Vercel. |
| **Next.js fit** | Best: same company, serverless API routes, edge. Zero config. | Good: runs `npm run build` + `npm run start`. API routes run in a single Node process (no serverless). |
| **Cost** | Free tier (hobby); paid for more bandwidth/team. | Included in your existing Hostinger plan; no extra app host bill. |
| **Domain / subdomain** | Add any custom domain or subdomain in dashboard; SSL auto. | Use your existing Hostinger domain; point subdomain to the Node.js app (panel or DNS). SSL often via Hostinger. |
| **Single dashboard** | App only; domain/DNS elsewhere unless you use Vercel Domains. | Domain, DNS, and app can all live in Hostinger (one account, one bill). |
| **Scaling** | Auto-scales per request (serverless). Cold starts possible on free tier. | One Node process; scaling depends on your plan (e.g. more RAM/CPU or multiple instances). No cold starts. |
| **Control** | Limited: you don’t manage OS or Node version beyond what Vercel supports. | More control: Node version, env, sometimes process manager. Still managed (no SSH like VPS). |
| **Deploy flow** | Git push → auto deploy. Preview URLs per branch. | Git integration or manual upload; redeploy from panel. |
| **Vendor lock-in** | Tied to Vercel for serverless/edge; app itself is standard Next.js. | Standard Node; easy to move to another Node host or VPS later. |

**Pros – Vercel**

- Fastest path to a live Next.js app; excellent DX.
- Free tier for hobby/small projects.
- Automatic HTTPS, preview deployments, and (if you need it) edge/serverless.
- No server or Node version to manage.

**Cons – Vercel**

- Free tier has limits (bandwidth, serverless execution).
- Custom domain is easy but lives in a second place if your main domain is on Hostinger.
- Less control over runtime and scaling model.

**Pros – Hostinger Node.js**

- Uses a plan you already have; one place for domain + app (and possibly email, etc.).
- Subdomain (e.g. `lms.yourdomain.com`) fits naturally with your existing domain.
- No cold starts; one long-running Node process.
- Standard Node/Next.js; easier to move to VPS or another host later.

**Cons – Hostinger Node.js**

- Setup and docs can be a bit less smooth than Vercel for Next.js specifically.
- Scaling is whatever your plan allows (no automatic serverless scaling).
- You depend on Hostinger’s Node.js stack and availability.

**Practical suggestion**

- **Prefer simplicity and “just get it live”** → Vercel.
- **Prefer one account (Hostinger), subdomain on your domain, and no extra cost** → Hostinger Node.js.

Both work for Coursify; the app is standard Next.js and talks to Supabase either way.

---

## Checklist

| Step | Action |
|------|--------|
| 1 | Supabase: run `database/schema.sql` if not already done |
| 2 | Supabase: add production URL to Auth → Redirect URLs (and Site URL) |
| 3 | Push code to Git; connect repo to Vercel (or Hostinger / other host) |
| 4 | Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL` (and optionally `SUPABASE_SERVICE_ROLE_KEY`) |
| 5 | Deploy; test sign-in and course save/publish |
| 6 | (Optional) Add custom domain/subdomain and update Supabase + `NEXT_PUBLIC_APP_URL` |

Once these are done, your Coursify app is live on the web.
