# VPS production deploy

Deploy **Coursify + self-hosted Supabase** on your VPS with Docker and Caddy TLS.

**Example domains** (replace with yours):

| Role | Domain |
|------|--------|
| App | `coursify.bsoc.space` |
| Supabase API (Kong) | `api.coursify.bsoc.space` |

**Branch:** `main`

---

## 1. DNS

Point both domains to your VPS public IP (A records):

```
coursify.bsoc.space      → YOUR_VPS_IP
api.coursify.bsoc.space  → YOUR_VPS_IP
```

---

## 2. VPS prerequisites

SSH into the server:

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install -y git curl

# Docker (official script)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# log out and back in

docker compose version   # must be v2+
```

**Recommended:** 4 GB+ RAM, 40 GB+ disk. Do **not** share Postgres with other apps.

---

## 3. Clone and deploy

```bash
cd ~
git clone https://github.com/Raghavendra-Pratap/Coursify-dev.git coursify
cd coursify
git checkout main

export APP_DOMAIN=coursify.bsoc.space
export API_DOMAIN=api.coursify.bsoc.space

./docker/deploy-vps.sh
```

This will:

1. Start Supabase Docker (Kong on `127.0.0.1:8000`)
2. Apply `database/schema.sql` + migrations
3. Write `.env.production` with Supabase keys
4. Build and run Coursify on `127.0.0.1:3000`

---

## 4. Secrets (before or after deploy)

Edit `.env.production`:

```bash
nano .env.production
```

| Variable | Required |
|----------|----------|
| `GOOGLE_CLIENT_ID` | Yes (Gmail sign-in) |
| `GOOGLE_CLIENT_SECRET` | Yes |
| `RESEND_API_KEY` | Optional (invite emails) |
| `RESEND_FROM_EMAIL` | Optional |
| `NEXT_PUBLIC_ASSESSMENT_PRO_ORIGIN` | If using assessments |

Then:

```bash
./docker/configure-google-oauth.sh
./docker/build-app.sh
```

**Google Cloud Console** → OAuth client → **Authorized redirect URIs**:

```
https://api.coursify.bsoc.space/auth/v1/callback
```

---

## 5. Caddy (HTTPS)

```bash
sudo apt install -y caddy
sudo cp docker/Caddyfile.example /etc/caddy/Caddyfile
# edit domains if different
sudo systemctl enable --now caddy
sudo systemctl reload caddy
```

Open https://coursify.bsoc.space

---

## 6. Copy data from Supabase Cloud (optional)

On your **laptop** (with cloud `.env.local` service role key):

```bash
./docker/export-from-cloud.sh
scp -r database/seed user@YOUR_VPS_IP:~/coursify/database/
```

On **VPS**:

```bash
cd ~/coursify
./docker/import-cloud-data.sh
./docker/configure-google-oauth.sh   # if not done
```

Gmail users sign in with **Sign in with Google** (same as cloud).

---

## 7. Firewall

Only expose web ports publicly:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Kong (`8000`) and Coursify (`3000`) stay on localhost — Caddy proxies them.

---

## 8. Updates

```bash
cd ~/coursify
git pull origin main
./docker/build-app.sh
# if schema changed:
./docker/apply-schema.sh
```

---

## 9. Backups

Daily cron example:

```bash
docker exec supabase-db pg_dump -U postgres postgres > ~/backups/coursify-$(date +%F).sql
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| OAuth redirect error | Match `NEXT_PUBLIC_APP_URL`, Supabase `SITE_URL`, Google callback URL |
| Empty My learning | Run `./docker/seed-dev-enrollments.sh` or import cloud data |
| 502 from Caddy | `docker ps` — ensure `coursify` and `supabase-kong` are up |
| Build fails: `key cannot contain a space` line 17 | Regenerate env (no comments): `export APP_DOMAIN=... API_DOMAIN=... && ./docker/configure-vps-production.sh` then add Google keys and rebuild |

See also [SELF_HOSTED_DOCKER.md](SELF_HOSTED_DOCKER.md).
