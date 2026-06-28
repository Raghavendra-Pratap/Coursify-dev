#!/usr/bin/env bash
# Export public data from Supabase Cloud (uses .env.local service role key).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
node docker/export-cloud-data.mjs
