#!/usr/bin/env bash
# Local dev: enroll all users in all published courses (My learning view).
set -euo pipefail

if ! docker ps --format '{{.Names}}' | grep -qx supabase-db; then
  echo "Supabase is not running."
  exit 1
fi

docker exec supabase-db psql -U postgres -d postgres -c "
INSERT INTO enrollments (course_id, user_id, progress_percentage)
SELECT c.id, u.id, 0
FROM courses c
CROSS JOIN auth.users u
WHERE c.status = 'published'
ON CONFLICT (course_id, user_id) DO NOTHING;
"

echo "Done. Refresh http://localhost:3000 (hard refresh if still empty: Cmd+Shift+R)."
