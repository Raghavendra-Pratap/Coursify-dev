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

export async function PATCH(request: Request, { params }: { params: Promise<{ courseId: string; questionId: string }> }) {
  const { courseId, questionId } = await params;
  const supabaseAuth = createAuthClient(request);
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const answerText = typeof body.answer_text === 'string' ? body.answer_text.trim() : '';
  const db = createServiceClient();
  // IMPORTANT: do not use is_course_owner_or_collaborator() with service role DB client here,
  // because auth.uid() is null in that context and permission check becomes false.
  const { data: ownerRow, error: ownerErr } = await db
    .from('courses')
    .select('id')
    .eq('id', courseId)
    .eq('created_by', user.id)
    .maybeSingle();
  if (ownerErr) return NextResponse.json({ error: ownerErr.message }, { status: 500 });
  let canAnswer = !!ownerRow;
  if (!canAnswer) {
    const { data: collabRow, error: collabErr } = await db
      .from('course_collaborators')
      .select('id')
      .eq('course_id', courseId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (collabErr) return NextResponse.json({ error: collabErr.message }, { status: 500 });
    canAnswer = !!collabRow;
  }
  if (!canAnswer) return NextResponse.json({ error: 'Only creator or collaborator can answer' }, { status: 403 });
  const { data: question, error } = await db.from('course_questions').update({ answer_text: answerText || null, answered_by: user.id, answered_at: new Date().toISOString() }).eq('id', questionId).eq('course_id', courseId).select('id, course_id, module_id, lesson_id, asked_by, question_text, answer_text, answered_by, answered_at, created_at').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 });

  // Notify learner that their question was answered.
  try {
    const askedBy = (question as { asked_by?: string | null }).asked_by ?? null;
    if (answerText && askedBy && askedBy !== user.id) {
      const prefs = await getNotificationPreferencesMap([askedBy]);
      if (prefs.get(askedBy)?.notify_question_answers ?? true) {
        const { data: c } = await db.from('courses').select('title').eq('id', courseId).maybeSingle();
        const courseTitle = (c as { title?: string | null } | null)?.title || 'Course';
        await db.from('user_notifications').insert({
          user_id: askedBy,
          type: 'question_answered',
          title: 'Your question was answered',
          body: `You received an answer in ${courseTitle}.`,
          link: `/`,
          related_id: courseId,
        });
      }
    }
  } catch {
    // Do not fail answer flow for notification errors.
  }

  return NextResponse.json({ question });
}


export async function DELETE(request: Request, { params }: { params: Promise<{ courseId: string; questionId: string }> }) {
  const { courseId, questionId } = await params;
  const supabaseAuth = createAuthClient(request);
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createServiceClient();
  // Only course creator can remove answers.
  const { data: courseOwner, error: ownerErr } = await db
    .from('courses')
    .select('id')
    .eq('id', courseId)
    .eq('created_by', user.id)
    .maybeSingle();
  if (ownerErr) return NextResponse.json({ error: ownerErr.message }, { status: 500 });
  if (!courseOwner) return NextResponse.json({ error: 'Only course creator can delete answers' }, { status: 403 });

  const { data: currentQuestion, error: qErr } = await db
    .from('course_questions')
    .select('id, course_id, answered_by, answer_text')
    .eq('id', questionId)
    .eq('course_id', courseId)
    .maybeSingle();
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });
  if (!currentQuestion) return NextResponse.json({ error: 'Question not found' }, { status: 404 });

  const answeredBy = (currentQuestion as { answered_by?: string | null }).answered_by ?? null;
  if (answeredBy && answeredBy !== user.id) {
    const { data: collabRow, error: collabErr } = await db
      .from('course_collaborators')
      .select('id')
      .eq('course_id', courseId)
      .eq('user_id', answeredBy)
      .maybeSingle();
    if (collabErr) return NextResponse.json({ error: collabErr.message }, { status: 500 });
    if (!collabRow) {
      return NextResponse.json({ error: 'Creator can delete only their or collaborator answers' }, { status: 403 });
    }
  }

  const { data: question, error } = await db
    .from('course_questions')
    .update({ answer_text: null, answered_by: null, answered_at: null })
    .eq('id', questionId)
    .eq('course_id', courseId)
    .select('id, course_id, module_id, lesson_id, asked_by, question_text, answer_text, answered_by, answered_at, created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ question });
}
