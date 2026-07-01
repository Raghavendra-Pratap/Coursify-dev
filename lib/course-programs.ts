import type { SupabaseClient } from '@supabase/supabase-js';
import { getInstructorCourseIds } from '@/lib/instructor-course-access';

export type CourseProgramSummary = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  courseIds: string[];
  courses: { id: string; title: string; order_index: number }[];
};

export async function listCoursePrograms(
  db: SupabaseClient,
  userId: string,
): Promise<CourseProgramSummary[]> {
  const { data: programs, error } = await db
    .from('course_programs')
    .select('id, title, description, created_at, updated_at')
    .eq('created_by', userId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  if (!programs?.length) return [];

  const programIds = programs.map((p: { id: string }) => p.id);
  const { data: members, error: memErr } = await db
    .from('course_program_members')
    .select('program_id, course_id, order_index, courses(id, title)')
    .in('program_id', programIds)
    .order('order_index');

  if (memErr) throw memErr;

  const byProgram = new Map<string, CourseProgramSummary['courses']>();
  for (const row of members ?? []) {
    const r = row as {
      program_id: string;
      course_id: string;
      order_index: number;
      courses?: { id: string; title: string } | { id: string; title: string }[] | null;
    };
    const course = Array.isArray(r.courses) ? r.courses[0] : r.courses;
    const list = byProgram.get(r.program_id) ?? [];
    list.push({
      id: r.course_id,
      title: course?.title ?? 'Course',
      order_index: r.order_index,
    });
    byProgram.set(r.program_id, list);
  }

  return programs.map((p: { id: string; title: string; description: string | null; created_at: string; updated_at: string }) => {
    const courses = (byProgram.get(p.id) ?? []).sort((a, b) => a.order_index - b.order_index);
    return {
      id: p.id,
      title: p.title,
      description: p.description,
      created_at: p.created_at,
      updated_at: p.updated_at,
      courseIds: courses.map((c) => c.id),
      courses,
    };
  });
}

export async function assertCoursesAssignable(
  db: SupabaseClient,
  userId: string,
  courseIds: string[],
): Promise<void> {
  if (courseIds.length === 0) {
    throw new Error('Select at least one course for the program.');
  }
  const unique = Array.from(new Set(courseIds));
  const { courseIds: allowed } = await getInstructorCourseIds(db, userId);
  const allowedSet = new Set(allowed);
  const bad = unique.filter((id) => !allowedSet.has(id));
  if (bad.length > 0) {
    throw new Error('One or more courses are not in your account.');
  }
}

export async function getProgramCourseIds(
  db: SupabaseClient,
  programId: string,
  userId: string,
): Promise<{ title: string; courseIds: string[] }> {
  const { data: program, error } = await db
    .from('course_programs')
    .select('id, title, created_by')
    .eq('id', programId)
    .maybeSingle();

  if (error) throw error;
  if (!program || (program as { created_by: string }).created_by !== userId) {
    throw new Error('Program not found.');
  }

  const { data: members, error: memErr } = await db
    .from('course_program_members')
    .select('course_id, order_index')
    .eq('program_id', programId)
    .order('order_index');

  if (memErr) throw memErr;

  return {
    title: (program as { title: string }).title,
    courseIds: (members ?? []).map((m: { course_id: string }) => m.course_id),
  };
}

export async function replaceProgramMembers(
  db: SupabaseClient,
  programId: string,
  courseIds: string[],
): Promise<void> {
  await db.from('course_program_members').delete().eq('program_id', programId);
  if (courseIds.length === 0) return;
  const rows = courseIds.map((course_id, order_index) => ({
    program_id: programId,
    course_id,
    order_index,
  }));
  const { error } = await db.from('course_program_members').insert(rows);
  if (error) throw error;
}
