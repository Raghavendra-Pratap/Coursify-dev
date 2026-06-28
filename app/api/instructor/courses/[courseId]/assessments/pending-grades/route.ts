import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { createServerClient as createServiceClient } from '@/lib/supabase-admin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  if (!courseId) {
    return NextResponse.json({ error: 'Course ID required' }, { status: 400 });
  }

  const cookieHeader = request.headers.get('cookie') ?? '';
  const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
        return match ? decodeURIComponent(match[1]) : undefined;
      },
      set() {},
      remove() {},
    },
  });

  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createServiceClient();
  const { data: course } = await db.from('courses').select('id, created_by').eq('id', courseId).single();
  if (!course || (course as { created_by: string }).created_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: modules } = await db.from('modules').select('id').eq('course_id', courseId);
  const moduleIds = (modules ?? []).map((m) => (m as { id: string }).id);
  if (moduleIds.length === 0) {
    return NextResponse.json({ pending: [] });
  }

  const { data: lessons } = await db.from('lessons').select('id').in('module_id', moduleIds);
  const lessonIds = (lessons ?? []).map((l) => (l as { id: string }).id);
  if (lessonIds.length === 0) {
    return NextResponse.json({ pending: [] });
  }

  const { data: contentItems } = await db
    .from('content_items')
    .select('id')
    .in('lesson_id', lessonIds)
    .eq('content_type', 'assessment');

  const contentItemIds = (contentItems ?? []).map((c) => (c as { id: string }).id);
  if (contentItemIds.length === 0) {
    return NextResponse.json({ pending: [] });
  }

  const { data: extAssessments } = await db
    .from('external_assessments')
    .select('id, content_item_id, title, passing_score')
    .in('content_item_id', contentItemIds);

  const extIds = (extAssessments ?? []).map((e) => (e as { id: string }).id);
  if (extIds.length === 0) {
    return NextResponse.json({ pending: [] });
  }

  const { data: sessions } = await db
    .from('external_assessment_sessions')
    .select('id, enrollment_id, external_assessment_id, status, auto_score, created_at, updated_at')
    .in('external_assessment_id', extIds)
    .eq('status', 'pending_manual_grade');

  const pending = [];
  for (const s of sessions ?? []) {
    const session = s as {
      id: string;
      enrollment_id: string;
      external_assessment_id: string;
      status: string;
      auto_score: number | null;
      created_at: string;
      updated_at: string;
    };
    const ext = (extAssessments ?? []).find((e) => (e as { id: string }).id === session.external_assessment_id) as
      | { content_item_id: string; title: string | null; passing_score: number | null }
      | undefined;
    if (!ext) continue;

    const { data: enrollment } = await db
      .from('enrollments')
      .select('user_id')
      .eq('id', session.enrollment_id)
      .single();

    let learnerEmail: string | null = null;
    let learnerName: string | null = null;
    if (enrollment) {
      const userId = (enrollment as { user_id: string }).user_id;
      const { data: profile } = await db.from('user_profiles').select('email, full_name').eq('id', userId).maybeSingle();
      if (profile) {
        learnerEmail = (profile as { email?: string }).email ?? null;
        learnerName = (profile as { full_name?: string }).full_name ?? null;
      }
    }

    const { data: responses } = await db
      .from('external_assessment_responses')
      .select('id, question_id, question_type, answer, auto_score, max_score, needs_manual_grade, manual_score')
      .eq('session_id', session.id)
      .eq('needs_manual_grade', true);

    pending.push({
      sessionId: session.id,
      contentItemId: ext.content_item_id,
      assessmentTitle: ext.title ?? 'Assessment',
      passingScore: ext.passing_score ?? 70,
      autoScore: session.auto_score,
      learnerEmail,
      learnerName,
      submittedAt: session.updated_at,
      responses: responses ?? [],
    });
  }

  return NextResponse.json({ pending });
}
