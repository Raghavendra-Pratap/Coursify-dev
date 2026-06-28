#!/usr/bin/env bash
# Apply Coursify schema + incremental migrations to self-hosted Supabase Postgres.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/docker/vendor/supabase/docker/.env"

MIGRATIONS=(
  "$ROOT/database/schema.sql"
  "$ROOT/database/MIGRATE_MISSING_TABLES.sql"
  "$ROOT/database/ADD_READING_SUPPORT.sql"
  "$ROOT/database/ADD_READING_FORMAT.sql"
  "$ROOT/database/ADD_LESSONS_DURATION.sql"
  "$ROOT/database/ADD_VIDEO_SEGMENTS_SEGMENT_INDEX.sql"
  "$ROOT/database/ADD_ENROLLMENTS_LAST_ACCESSED.sql"
  "$ROOT/database/COURSE_COLLABORATORS.sql"
  "$ROOT/database/DRAFT_PUBLISHED_SNAPSHOT.sql"
  "$ROOT/database/ADD_LEARNER_NOTES.sql"
  "$ROOT/database/ADD_COURSE_QUESTIONS_PARENT_ID.sql"
  "$ROOT/database/ADD_COURSE_RATINGS_ID.sql"
  "$ROOT/database/ADD_NOTIFICATION_PREFERENCES.sql"
  "$ROOT/database/ADD_EXTERNAL_ASSESSMENTS.sql"
  "$ROOT/database/ADD_QUIZ_FORM_URL.sql"
  "$ROOT/database/ADD_QUIZ_WEBHOOK_ENTRY.sql"
  "$ROOT/database/WEBHOOK_QUIZ_TOKEN_USED.sql"
  "$ROOT/database/DEFAULT_ROLE_INSTRUCTOR.sql"
  "$ROOT/database/FIX_COURSES_INSERT_RLS.sql"
  "$ROOT/database/FIX_LESSONS_RLS.sql"
  "$ROOT/database/FIX_VIDEO_SEGMENTS_RLS.sql"
  "$ROOT/database/FIX_VIDEO_SEGMENTS_RLS_CONTENT_ITEMS.sql"
)

if [ ! -f "$ENV_FILE" ]; then
  echo "Run ./docker/setup-supabase.sh first."
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"

if [ -z "${POSTGRES_PASSWORD:-}" ]; then
  echo "POSTGRES_PASSWORD not set in $ENV_FILE"
  exit 1
fi

run_sql() {
  local file="$1"
  if [ ! -f "$file" ]; then
    echo "Skip missing: $file"
    return 0
  fi
  echo "Applying $(basename "$file") …"
  if command -v psql >/dev/null 2>&1; then
    PGPASSWORD="$POSTGRES_PASSWORD" psql \
      -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
      -v ON_ERROR_STOP=0 \
      -f "$file"
  else
    docker exec -i supabase-db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=0 < "$file"
  fi
}

for f in "${MIGRATIONS[@]}"; do
  run_sql "$f"
done

echo "Done. 'already exists' / duplicate policy errors on re-run are usually safe."
