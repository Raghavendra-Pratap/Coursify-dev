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

export async function PATCH(request: Request, { params }: { params: Promise<{ courseId: string; questionId: string }> }) {
  const { courseId, questionId } = await params;
  const supabaseAuth = createAuthClient(request);
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const answerText = typeof body.answer_text === 'string' ? body.answer_text.trim() : '';
  const db = createServiceClient();
  const { data: canAnswer } = await db.rpc('is_course_owner_or_collaborator', { cid: courseId });
  if (!canAnswer) return NextResponse.json({ error: 'Only creator or collaborator can answer' }, { status: 403 });
  const { data: question, error } = await db.from('course_questions').update({ answer_text: answerText || null, answered_by: user.id, answered_at: new Date().toISOString() }).eq('id', questionId).eq('course_id', courseId).select('id, course_id, module_id, lesson_id, asked_by, question_text, answer_text, answered_by, answered_at, created_at').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 });
  return NextResponse.json({ question });
}
