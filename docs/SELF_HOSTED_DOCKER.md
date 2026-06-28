# Self-hosted Docker: local + VPS production

Run **Coursify** and **Supabase** on your own infrastructure — no Supabase Cloud, no dependency on another app’s Postgres.

**Architecture (Path 1):**

```
┌──────────────────────────────────────────────────────────────┐
│  Your machine (local) or VPS (production)                     │
│                                                               │
│  ┌──────────────── Supabase Docker ─────────────────────┐   │
│  │  Kong :8000  →  Auth (GoTrue) + PostgREST + Postgres   │   │
│  │  Studio :3000 (admin UI)                               │   │
│  └────────────────────────────────────────────────────────┘   │
│                          ▲                                    │
│                          │ NEXT_PUBLIC_SUPABASE_URL           │
│  ┌──────────────── Coursify ──────────────────────────────┐   │
│  │  Next.js  :3001 (local) or :3000 (VPS behind Caddy)    │   │
│  └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
    Resend (email)              Assessment Pro / videos (external)
```

**Last updated:** 2025-06

---

## Prerequisites

| | Local | VPS production |
|--|--------|----------------|
| Docker Engine + Compose v2 | ✅ | ✅ |
| RAM | 4 GB+ recommended | 4 GB+ (Supabase stack ~2 GB) |
| Domain | optional | HTTPS domain for app + API |
| Ports (default) | 8000 API, 3000 Studio, 3001 app | 443 via reverse proxy |

---

## Part 1 — Supabase stack (same on local and VPS)

### 1. Start Supabase

From the repo root:

```bash
chmod +x docker/*.sh
./docker/setup-supabase.sh
```

This clones [Supabase’s official docker](https://github.com/supabase/supabase/tree/master/docker) into `docker/vendor/supabase` (gitignored) and runs `docker compose up -d`.

Default endpoints:

| Service | URL |
|---------|-----|
| API (Kong) | http://localhost:8000 |
| Studio | http://localhost:3000 |
| Postgres | localhost:5432 |

Wait ~30 seconds after first start.

### 2. Apply Coursify schema

```bash
./docker/apply-schema.sh
```

Runs `database/schema.sql` against the Supabase Postgres (`auth.users` and RLS policies are included).

Re-runs may show “already exists” — usually safe.

### 3. Get API keys

```bash
./docker/print-keys.sh
```

Copy output into your env file (next section).

### 4. Enable Google sign-in (required if users use Gmail OAuth)

Cloud users sign in with Google, not passwords. After Supabase is running:

```bash
./docker/configure-google-oauth.sh
```

Then in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → your OAuth client → **Authorized redirect URIs**, add:

```
http://localhost:8000/auth/v1/callback
```

Use **Sign in with Google** at http://localhost:3000. Imported users keep the same UUIDs so courses still match.

### 5. (Optional) Copy data from Supabase Cloud

If you already have courses on Supabase Cloud and want the same data locally or on VPS:

```bash
# From repo root — uses SUPABASE_SERVICE_ROLE_KEY in .env.local
./docker/export-from-cloud.sh

./docker/setup-supabase.sh   # if not already running
./docker/apply-schema.sh
./docker/import-cloud-data.sh
```

Exports land in `database/seed/` (gitignored). Auth users are created without passwords — use Google OAuth (step 4 above).

For a full Postgres dump (including `auth.users` hashes), use your [database password](https://supabase.com/dashboard/project/_/settings/database) with `pg_dump`:

```bash
pg_dump "postgresql://postgres.[ref]:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres" \
  --schema=public --schema=auth --data-only -f database/seed/full-dump.sql
```

---

## Part 2 — Local development

Two equivalent options — pick one.

### Option A — Fastest daily dev (recommended)

Supabase in Docker, Coursify on the host:

```bash
./docker/setup-supabase.sh
./docker/apply-schema.sh
./docker/print-keys.sh

cp .env.selfhosted.example .env.local
# Fill keys from print-keys.sh; set NEXT_PUBLIC_APP_URL=http://localhost:3000

npm install
npm run dev
```

Open http://localhost:3000 — API at http://localhost:8000.

### Option B — Full Docker locally (matches VPS)

```bash
cp .env.selfhosted.example .env.production
# Fill keys; keep NEXT_PUBLIC_APP_URL=http://localhost:3001 and APP_PORT=3001

./docker/build-app.sh
```

Open http://localhost:3001 (Studio stays on :3000).

---

## Part 3 — VPS production

Use a **dedicated** directory — do not share Postgres with other apps.

```bash
git clone https://github.com/Raghavendra-Pratap/Coursify-dev.git
cd Coursify-dev && git checkout main
```

See **[VPS_DEPLOY.md](VPS_DEPLOY.md)** for the full checklist (DNS, Caddy, OAuth, data import).

Quick start:

```bash
export APP_DOMAIN=coursify.yourdomain.com
export API_DOMAIN=api.coursify.yourdomain.com
./docker/deploy-vps.sh
```

### Configure Supabase for production

Edit `docker/vendor/supabase/docker/.env`:

| Variable | Example |
|----------|---------|
| `SITE_URL` | `https://coursify.yourdomain.com` |
| `API_EXTERNAL_URL` | `https://api.yourdomain.com` |
| `SUPABASE_PUBLIC_URL` | `https://api.yourdomain.com` |
| `GOTRUE_EXTERNAL_GOOGLE_ENABLED` | `true` |
| `GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID` | from Google Cloud |
| `GOTRUE_EXTERNAL_GOOGLE_SECRET` | from Google Cloud |
| `GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI` | `https://api.yourdomain.com/auth/v1/callback` |

Restart Supabase after edits:

```bash
cd docker/vendor/supabase/docker && docker compose up -d
```

### Configure Coursify

```bash
cp .env.selfhosted.example .env.production
nano .env.production
```

| Variable | Production value |
|----------|------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://api.yourdomain.com` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from `./docker/print-keys.sh` |
| `SUPABASE_SERVICE_ROLE_KEY` | from print-keys (keep secret) |
| `NEXT_PUBLIC_APP_URL` | `https://coursify.yourdomain.com` |
| `APP_PORT` | `3000` |
| `RESEND_API_KEY` | optional |

Build and run:

```bash
docker compose up -d --build
```

### Reverse proxy (Caddy example)

```caddy
coursify.yourdomain.com {
  reverse_proxy localhost:3000
}

api.yourdomain.com {
  reverse_proxy localhost:8000
}
```

TLS via Caddy automatic HTTPS.

### Google OAuth redirect URLs

In Google Cloud Console, add:

- `https://api.yourdomain.com/auth/v1/callback`
- `https://coursify.yourdomain.com/**` (app origin)

In Supabase Studio → Authentication → URL configuration (or via `.env` above):

- Site URL: `https://coursify.yourdomain.com`
- Redirect URLs: `https://coursify.yourdomain.com/**`

---

## Local vs production summary

| | Local (dev) | VPS (prod) |
|--|-------------|------------|
| Supabase API | http://localhost:8000 | https://api.yourdomain.com |
| Coursify | :3000 (`npm run dev`) or :3001 (docker) | https://coursify.yourdomain.com |
| Env file | `.env.local` or `.env.production` | `.env.production` |
| Data | Docker volume on your machine | Docker volume on VPS — **back up** |

Same schema, same app image, same `./docker/setup-supabase.sh` flow.

---

## Operations

```bash
# Stop Supabase (keep data)
./docker/stop-supabase.sh

# Stop Coursify app only
docker compose down

# Logs
docker compose logs -f coursify
cd docker/vendor/supabase/docker && docker compose logs -f

# Rebuild app after code changes
./docker/build-app.sh
```

### Backups (production)

Back up the Supabase Postgres volume regularly:

```bash
docker exec supabase-db pg_dump -U postgres postgres > coursify-backup-$(date +%F).sql
```

Store off-server.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Coursify in Docker can’t reach API | Use `NEXT_PUBLIC_SUPABASE_URL=http://host.docker.internal:8000` or public API URL |
| OAuth redirect mismatch | Align `NEXT_PUBLIC_APP_URL`, GoTrue `SITE_URL`, and Google redirect URI |
| Port 3000 in use | Use `APP_PORT=3001` for Coursify; leave Studio on 3000 |
| `apply-schema` fails | Ensure Supabase is up: `curl http://localhost:8000/rest/v1/` |
| `docker compose up -d --build` without env file | Use `./docker/build-app.sh` (loads `.env.production` for build args) |

---

## Related docs

- [SECRETS_AND_ROTATION.md](SECRETS_AND_ROTATION.md) — rotate keys safely
- [RESEND_EMAIL.md](RESEND_EMAIL.md) — invite emails
- [Supabase self-hosting](https://supabase.com/docs/guides/self-hosting/docker)

---

## What you are *not* running

- Supabase Cloud (hosted)
- Another app’s Postgres container
- Supabase paid “branching” — use separate VPS volumes or a second machine for staging if needed
