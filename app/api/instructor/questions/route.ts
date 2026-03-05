import { createServerClient } from '@supabase/ssr';
import { createServerClient as createServiceClient } from '@/lib/supabase';
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
  const allCourseIds = [...new Set([...courseIds, ...collabIds])];
  if (allCourseIds.length === 0) return NextResponse.json({ threads: [] });
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
  const cIds = [...new Set(questions.map((q: { course_id: string }) => q.course_id))];
  const lIds = [...new Set(questions.map((q: { lesson_id: string | null }) => q.lesson_id).filter(Boolean))];
  const { data: courses } = await db.from('courses').select('id, title').in('id', cIds);
  const { data: lessons } = lIds.length ? await db.from('lessons').select('id, title').in('id', lIds) : { data: [] };
  const courseTitleBy = new Map((courses ?? []).map((c: { id: string; title: string }) => [c.id, c.title]));
  const lessonTitleBy = new Map((lessons ?? []).map((l: { id: string; title: string }) => [l.id, l.title]));
  const threads = roots.map((r: { id: string; course_id: string; lesson_id: string | null }) => ({
    ...r,
    courseTitle: courseTitleBy.get(r.course_id) ?? 'Course',
    lessonTitle: r.lesson_id ? (lessonTitleBy.get(r.lesson_id) ?? 'Lesson') : 'Lesson',
    followUps: (byParent.get(r.id) ?? []).map((f: { course_id: string; lesson_id: string | null }) => ({
      ...f,
      courseTitle: courseTitleBy.get(f.course_id) ?? 'Course',
      lessonTitle: f.lesson_id ? (lessonTitleBy.get(f.lesson_id) ?? 'Lesson') : 'Lesson',
    })),
  }));
  return NextResponse.json({ threads });
}
