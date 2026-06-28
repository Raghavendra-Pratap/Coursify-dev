# Deploy Coursify on a VPS with Docker

Run the Next.js app on your own VPS while keeping **Supabase** for auth and database (recommended). Videos stay on YouTube / Google Drive / external URLs — nothing heavy is stored in the container.

**Last updated:** 2025-06

---

## Architecture

```
Internet → Caddy/nginx (TLS) → Docker :3000 → Coursify (Next.js)
                                      ↓
                              Supabase (hosted)
                              Resend (email API)
```

You are **not** required to self-host Postgres unless you want a full migration later.

---

## Prerequisites

- VPS with Docker Engine 24+ and Docker Compose v2 (Ubuntu 22.04+ is fine)
- Domain pointing to the VPS (A record)
- Supabase project with schema from `database/schema.sql`
- Same env vars you use on Vercel (see `.env.production.example`)

---

## Quick start on the VPS

```bash
# 1. Clone
git clone https://github.com/Raghavendra-Pratap/Coursify-dev.git
cd Coursify-dev
git checkout develop   # or main

# 2. Configure environment
cp .env.production.example .env.production
nano .env.production   # fill all required values

# 3. Build and run
docker compose up -d --build

# 4. Check
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/
docker compose logs -f coursify
```

Set `NEXT_PUBLIC_APP_URL` to your **public HTTPS URL** before building — it is baked into invite links and OAuth redirects.

---

## Supabase after moving off Vercel

In [Supabase Dashboard](https://supabase.com/dashboard) → **Authentication → URL configuration**:

| Setting | Value |
|---------|--------|
| Site URL | `https://coursify.yourdomain.com` |
| Redirect URLs | `https://coursify.yourdomain.com/**`, `http://localhost:3000/**` (local dev) |

Google OAuth (if used): add the VPS URL to Google Cloud Console authorized redirect URIs.

---

## HTTPS with Caddy (example)

On the VPS host (not inside the app container):

```bash
sudo apt install -y caddy
```

`/etc/caddy/Caddyfile`:

```
coursify.yourdomain.com {
  reverse_proxy localhost:3000
}
```

```bash
sudo systemctl reload caddy
```

Caddy obtains and renews Let's Encrypt certificates automatically.

---

## nginx example

```nginx
server {
  listen 443 ssl http2;
  server_name coursify.yourdomain.com;

  ssl_certificate     /etc/letsencrypt/live/coursify.yourdomain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/coursify.yourdomain.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

---

## Updating the app

```bash
cd Coursify-dev
git pull
docker compose up -d --build
```

Rebuild when **`NEXT_PUBLIC_*`** variables change (they are embedded at build time). Server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`) can be updated in `.env.production` followed by `docker compose up -d` without rebuild.

---

## Build without Compose

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  --build-arg NEXT_PUBLIC_APP_URL="https://coursify.yourdomain.com" \
  -t coursify-lms:latest .

docker run -d --name coursify -p 3000:3000 --env-file .env.production coursify-lms:latest
```

---

## Resource guidance

| Users | Suggested VPS |
|-------|----------------|
| &lt; 500 | 2 vCPU, 2 GB RAM |
| 500–2000 | 2 vCPU, 4 GB RAM |

The container typically uses ~200–400 MB RAM at idle.

---

## Vercel vs VPS

| | Vercel | VPS + Docker |
|--|--------|----------------|
| Ops | Low | You manage OS, TLS, updates |
| Cost | Free tier → paid | ~$5–15/mo |
| Supabase | Same | Same |
| Cold starts | Possible on free tier | None (always on) |
| Region | Fixed (e.g. iad1) | You choose |

You can run **both**: keep Vercel for staging (`develop`) and VPS for production.

---

## Troubleshooting

| Issue | Check |
|-------|--------|
| Build fails on VPS | `docker compose build --no-cache`; ensure 2 GB+ RAM (add swap if needed) |
| Auth redirect loop | Supabase Site URL + redirect URLs match `NEXT_PUBLIC_APP_URL` |
| Invite emails fail | `RESEND_API_KEY` in `.env.production`; restart container |
| 502 from proxy | `docker compose ps`; app listening on `0.0.0.0:3000` |
| Healthcheck failing | `wget` missing in minimal images — healthcheck uses busybox wget on alpine |

---

## Related

- [RESEND_EMAIL.md](RESEND_EMAIL.md)
- [SUPABASE_AUTH_SETUP.md](SUPABASE_AUTH_SETUP.md)
- [BRANCH_AND_DEPLOY.md](BRANCH_AND_DEPLOY.md)
