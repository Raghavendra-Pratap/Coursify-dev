import { createServerClient } from '@supabase/ssr';
import { createServerClient as createServiceClient } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function createAuthClient(request: Request) {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.headers.get('cookie')?.split(';').find((c) => c.trim().startsWith(name + '='))?.split('=')[1] ?? undefined;
      },
      set() {},
      remove() {},
    },
  });
}

export async function GET(request: Request) {
  const supabaseAuth = createAuthClient(request);
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = createServiceClient();
  const { data: myCourses } = await db.from('courses').select('id').eq('created_by', user.id);
  const courseIds = (myCourses ?? []).map((c: { id: string }) => c.id);
  const { data: collabRows } = await db.from('course_collaborators').select('course_id').eq('user_id', user.id);
  const collabIds = (collabRows ?? []).map((c: { course_id: string }) => c.course_id);
  const allCourseIds = Array.from(new Set([...courseIds, ...collabIds]));
  if (allCourseIds.length === 0) return NextResponse.json({ threads: [] }, { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=60' } });
  const selectCols = 'id, course_id, module_id, lesson_id, parent_id, asked_by, question_text, answer_text, answered_by, answered_at, created_at';
  const { data: rows, error } = await db.from('course_questions').select(selectCols).in('course_id', allCourseIds).order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const questions = rows ?? [];
  const roots = questions.filter((q: { parent_id: string | null }) => !q.parent_id);
  const byParent = new Map<string, typeof questions>();
  for (const q of questions) {
    if (q.parent_id) {
      const list = byParent.get(q.parent_id) ?? [];
      list.push(q);
      byParent.set(q.parent_id, list);
    }
  }
  const cIds = Array.from(new Set(questions.map((q: { course_id: string }) => q.course_id)));
  const lIds = Array.from(new Set(questions.map((q: { lesson_id: string | null }) => q.lesson_id).filter(Boolean)));
  const { data: courses } = await db.from('courses').select('id, title, created_by').in('id', cIds);
  const { data: lessons } = lIds.length ? await db.from('lessons').select('id, title').in('id', lIds) : { data: [] };

  const userIds = Array.from(new Set(
    questions
      .flatMap((q: { asked_by: string; answered_by: string | null }) => [q.asked_by, q.answered_by])
      .filter(Boolean)
  ));
  const { data: profiles } = userIds.length
    ? await db.from('user_profiles').select('id, full_name').in('id', userIds as string[])
    : { data: [] };

  const courseTitleBy = new Map((courses ?? []).map((c: { id: string; title: string }) => [c.id, c.title]));
  const courseCreatorBy = new Map((courses ?? []).map((c: { id: string; created_by: string }) => [c.id, c.created_by]));
  const userNameBy = new Map((profiles ?? []).map((u: { id: string; full_name: string | null }) => [u.id, u.full_name || 'User']));
  const lessonTitleBy = new Map((lessons ?? []).map((l: { id: string; title: string }) => [l.id, l.title]));
  const threads = roots.map((r: { id: string; course_id: string; lesson_id: string | null; asked_by: string; answered_by: string | null }) => ({
    ...r,
    courseTitle: courseTitleBy.get(r.course_id) ?? 'Course',
    lessonTitle: r.lesson_id ? (lessonTitleBy.get(r.lesson_id) ?? 'Lesson') : 'Lesson',
    courseCreatorId: courseCreatorBy.get(r.course_id) ?? null,
    askedByName: userNameBy.get(r.asked_by) ?? null,
    answeredByName: r.answered_by ? (userNameBy.get(r.answered_by) ?? null) : null,
    followUps: (byParent.get(r.id) ?? []).map((f: { course_id: string; lesson_id: string | null; asked_by: string; answered_by: string | null }) => ({
      ...f,
      courseTitle: courseTitleBy.get(f.course_id) ?? 'Course',
      lessonTitle: f.lesson_id ? (lessonTitleBy.get(f.lesson_id) ?? 'Lesson') : 'Lesson',
      courseCreatorId: courseCreatorBy.get(f.course_id) ?? null,
      askedByName: userNameBy.get(f.asked_by) ?? null,
      answeredByName: f.answered_by ? (userNameBy.get(f.answered_by) ?? null) : null,
    })),
  }));
  return NextResponse.json({ threads }, { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=60' } });
}
