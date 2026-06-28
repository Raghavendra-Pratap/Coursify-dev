#!/usr/bin/env bash
# Validate .env.production before docker compose reads it.
set -euo pipefail

ENV_FILE="${1:-$(cd "$(dirname "$0")/.." && pwd)/.env.production}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE"
  exit 1
fi

line_num=0
while IFS= read -r line || [ -n "$line" ]; do
  line_num=$((line_num + 1))
  # trim
  trimmed="${line#"${line%%[![:space:]]*}"}"
  trimmed="${trimmed%"${trimmed##*[![:space:]]}"}"
  [ -z "$trimmed" ] && continue
  [[ "$trimmed" == \#* ]] && continue

  if [[ "$trimmed" != *=* ]]; then
    echo "Invalid line $line_num (need KEY=value, no spaces in key):"
    echo "  $line"
    echo ""
    echo "Fix: delete this line or prefix with # for a comment."
    echo "Or regenerate: export APP_DOMAIN=... API_DOMAIN=... && ./docker/configure-vps-production.sh"
    exit 1
  fi

  key="${trimmed%%=*}"
  if [[ "$key" == *" "* ]] || [[ "$key" == *$'\t'* ]]; then
    echo "Invalid line $line_num — key cannot contain spaces:"
    echo "  $line"
    echo ""
    echo "Use underscores: GOOGLE_CLIENT_ID=... not \"GOOGLE CLIENT_ID=...\""
    exit 1
  fi
done < "$ENV_FILE"

echo "OK: $ENV_FILE"
