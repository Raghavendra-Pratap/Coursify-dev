import { createServerClient } from '@supabase/ssr';
import { createServerClient as createServiceClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { getNotificationPreferencesMap } from '@/lib/notification-preferences';

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

const SELECT_COLS = 'id, course_id, module_id, lesson_id, parent_id, asked_by, question_text, answer_text, answered_by, answered_at, created_at';

export async function GET(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const { searchParams } = new URL(request.url);
  const lessonId = searchParams.get('lessonId') ?? undefined;
  const moduleId = searchParams.get('moduleId') ?? undefined;
  const supabaseAuth = createAuthClient(request);
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = createServiceClient();
  const { data: isCreatorOrCollab } = await db.rpc('is_course_owner_or_collaborator', { cid: courseId });
  const canAnswer = !!isCreatorOrCollab;
  const { data: enrollment } = await db.from('enrollments').select('id').eq('course_id', courseId).eq('user_id', user.id).maybeSingle();
  if (!enrollment && !canAnswer) return NextResponse.json({ error: 'You must be enrolled to view questions' }, { status: 403 });
  let query = db.from('course_questions').select(SELECT_COLS).eq('course_id', courseId).order('created_at', { ascending: true });
  if (lessonId) query = query.eq('lesson_id', lessonId);
  if (moduleId) query = query.eq('module_id', moduleId);
  const { data: rows, error } = await query;
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
  const threads = roots.map((r: { id: string }) => ({ ...r, followUps: byParent.get(r.id) ?? [] }));
  return NextResponse.json({ questions: threads, canAnswer });
}

export async function POST(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const supabaseAuth = createAuthClient(request);
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const questionText = typeof body.question_text === 'string' ? body.question_text.trim() : '';
  const lessonId = typeof body.lesson_id === 'string' && body.lesson_id ? body.lesson_id : null;
  const moduleId = typeof body.module_id === 'string' && body.module_id ? body.module_id : null;
  const parentId = typeof body.parent_id === 'string' && body.parent_id ? body.parent_id : null;
  if (!questionText) return NextResponse.json({ error: 'question_text is required' }, { status: 400 });
  const db = createServiceClient();
  const { data: enrollment } = await db.from('enrollments').select('id').eq('course_id', courseId).eq('user_id', user.id).maybeSingle();
  if (!enrollment) return NextResponse.json({ error: 'You must be enrolled to ask questions' }, { status: 403 });
  let insertPayload: Record<string, unknown> = { course_id: courseId, module_id: moduleId, lesson_id: lessonId, asked_by: user.id, question_text: questionText };
  if (parentId) {
    const { data: parent } = await db.from('course_questions').select('id, course_id, lesson_id, module_id').eq('id', parentId).eq('course_id', courseId).single();
    if (!parent) return NextResponse.json({ error: 'Parent question not found' }, { status: 404 });
    insertPayload = { course_id: courseId, module_id: parent.module_id, lesson_id: parent.lesson_id, parent_id: parentId, asked_by: user.id, question_text: questionText };
  }
  const { data: question, error } = await db.from('course_questions').insert(insertPayload).select(SELECT_COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify course creator/collaborators about learner questions.
  try {
    const { data: c } = await db.from('courses').select('title, created_by').eq('id', courseId).maybeSingle();
    const courseTitle = (c as { title?: string | null } | null)?.title || 'Course';
    const creatorId = (c as { created_by?: string } | null)?.created_by;
    const { data: collabs } = await db.from('course_collaborators').select('user_id').eq('course_id', courseId);
    const recipientIds = Array.from(new Set([creatorId, ...((collabs ?? []).map((r: { user_id: string }) => r.user_id))].filter(Boolean))) as string[];
    const notifyIds = recipientIds.filter((id) => id !== user.id);
    if (notifyIds.length > 0) {
      const prefs = await getNotificationPreferencesMap(notifyIds);
      const targetIds = notifyIds.filter((id) => (prefs.get(id)?.notify_new_questions ?? true));
      if (targetIds.length > 0) {
        await db.from('user_notifications').insert(
          targetIds.map((uid) => ({
            user_id: uid,
            type: 'question_asked',
            title: 'New learner question',
            body: `A learner asked a question in ${courseTitle}.`,
            link: `/`,
            related_id: courseId,
          }))
        );
      }
    }
  } catch {
    // Do not fail the question flow for notification errors.
  }

  return NextResponse.json({ question });
}
