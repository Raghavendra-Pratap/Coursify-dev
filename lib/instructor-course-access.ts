import type { SupabaseClient } from '@supabase/supabase-js';

/** Course IDs the user may manage (owner, collaborator, or all if admin). */
export async function getInstructorCourseIds(
  db: SupabaseClient,
  userId: string
): Promise<{ courseIds: string[]; isAdmin: boolean }> {
  const { data: profile } = await db.from('user_profiles').select('role').eq('id', userId).maybeSingle();
  const isAdmin = (profile as { role?: string } | null)?.role === 'admin';

  if (isAdmin) {
    const { data: allCourses } = await db.from('courses').select('id');
    return { courseIds: (allCourses ?? []).map((c: { id: string }) => c.id), isAdmin: true };
  }

  const [{ data: owned }, { data: collab }] = await Promise.all([
    db.from('courses').select('id').eq('created_by', userId),
    db.from('course_collaborators').select('course_id').eq('user_id', userId),
  ]);

  const courseIds = Array.from(
    new Set([
      ...(owned ?? []).map((c: { id: string }) => c.id),
      ...(collab ?? []).map((c: { course_id: string }) => c.course_id),
    ])
  );
  return { courseIds, isAdmin: false };
}
