import 'server-only';
import { createServerClient } from '@/lib/supabase-admin';

export type CourseInviteDetails = {
  courseTitle: string;
  moduleCount: number;
  lessonCount: number;
  durationLabel: string;
  inviterName?: string;
};

function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0 || !Number.isFinite(totalSeconds)) return '0m';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

/** Course metadata for invitation emails and API responses. */
export async function fetchCourseInviteDetails(
  courseId: string,
  inviterName?: string,
): Promise<CourseInviteDetails | null> {
  try {
    const db = createServerClient();
    const { data: course } = await db
      .from('courses')
      .select('id, title')
      .eq('id', courseId)
      .maybeSingle();
    if (!course) return null;

    const { data: modules } = await db.from('modules').select('id').eq('course_id', courseId);
    const moduleIds = (modules ?? []).map((m: { id: string }) => m.id);
    const moduleCount = moduleIds.length;

    let lessonCount = 0;
    let durationSeconds = 0;
    if (moduleIds.length > 0) {
      const { data: lessons } = await db
        .from('lessons')
        .select('duration_seconds')
        .in('module_id', moduleIds);
      lessonCount = lessons?.length ?? 0;
      durationSeconds = (lessons ?? []).reduce(
        (sum: number, l: { duration_seconds?: number | null }) => sum + (Number(l.duration_seconds) || 0),
        0,
      );
    }

    return {
      courseTitle: (course as { title: string }).title,
      moduleCount,
      lessonCount,
      durationLabel: formatDuration(durationSeconds),
      inviterName,
    };
  } catch {
    return null;
  }
}
