#!/usr/bin/env bash
# Read a single KEY=value from Supabase docker .env without sourcing the whole file.
read_supabase_env() {
  local key="$1" file="$2" line val
  line=$(grep -E "^${key}=" "$file" | head -1 || true)
  if [ -z "$line" ]; then
    return 1
  fi
  val="${line#*=}"
  val="${val%\"}"
  val="${val#\"}"
  val="${val%\'}"
  val="${val#\'}"
  printf '%s' "$val"
}
