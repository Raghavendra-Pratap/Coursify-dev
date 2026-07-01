import 'server-only';
import { createServerClient } from '@/lib/supabase-admin';

export type ProgramInviteDetails = {
  programTitle: string;
  description: string | null;
  courseTitles: string[];
  courseCount: number;
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

export async function fetchProgramInviteDetails(
  programId: string,
  inviterName?: string,
): Promise<ProgramInviteDetails | null> {
  try {
    const db = createServerClient();
    const { data: program } = await db
      .from('course_programs')
      .select('id, title, description')
      .eq('id', programId)
      .maybeSingle();
    if (!program) return null;

    const { data: members } = await db
      .from('course_program_members')
      .select('course_id, order_index, courses(id, title)')
      .eq('program_id', programId)
      .order('order_index');

    const courseIds: string[] = [];
    const courseTitles: string[] = [];
    for (const row of members ?? []) {
      const r = row as {
        course_id: string;
        courses?: { id: string; title: string } | { id: string; title: string }[] | null;
      };
      courseIds.push(r.course_id);
      const c = Array.isArray(r.courses) ? r.courses[0] : r.courses;
      if (c?.title) courseTitles.push(c.title);
    }

    let moduleCount = 0;
    let lessonCount = 0;
    let durationSeconds = 0;
    if (courseIds.length > 0) {
      const { data: modules } = await db.from('modules').select('id').in('course_id', courseIds);
      const moduleIds = (modules ?? []).map((m: { id: string }) => m.id);
      moduleCount = moduleIds.length;
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
    }

    return {
      programTitle: (program as { title: string }).title,
      description: (program as { description: string | null }).description,
      courseTitles,
      courseCount: courseTitles.length,
      moduleCount,
      lessonCount,
      durationLabel: formatDuration(durationSeconds),
      inviterName,
    };
  } catch {
    return null;
  }
}
