import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { createServerClient as createServiceClient } from '@/lib/supabase';
import { syncAssessmentProgress } from '@/lib/assessment-progress';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type GradeBody = {
  responses?: Array<{ questionId: string; manualScore: number; reviewerNotes?: string }>;
  finalScore?: number;
  passed?: boolean;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
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

  let body: GradeBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const db = createServiceClient();

  const { data: session } = await db
    .from('external_assessment_sessions')
    .select('id, enrollment_id, external_assessment_id, status, auto_score')
    .eq('id', sessionId)
    .single();

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const s = session as {
    id: string;
    enrollment_id: string;
    external_assessment_id: string;
    status: string;
    auto_score: number | null;
  };

  if (s.status !== 'pending_manual_grade') {
    return NextResponse.json({ error: 'Session is not awaiting manual grading' }, { status: 400 });
  }

  const { data: extAssessment } = await db
    .from('external_assessments')
    .select('id, content_item_id, passing_score')
    .eq('id', s.external_assessment_id)
    .single();

  if (!extAssessment) {
    return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
  }

  const ext = extAssessment as { content_item_id: string; passing_score: number | null };

  const { data: contentItem } = await db
    .from('content_items')
    .select('lesson_id')
    .eq('id', ext.content_item_id)
    .single();

  if (!contentItem) {
    return NextResponse.json({ error: 'Content item not found' }, { status: 404 });
  }

  const { data: lesson } = await db
    .from('lessons')
    .select('module_id')
    .eq('id', (contentItem as { lesson_id: string }).lesson_id)
    .single();

  if (!lesson) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
  }

  const { data: moduleRow } = await db
    .from('modules')
    .select('course_id')
    .eq('id', (lesson as { module_id: string }).module_id)
    .single();

  if (!moduleRow) {
    return NextResponse.json({ error: 'Module not found' }, { status: 404 });
  }

  const { data: course } = await db
    .from('courses')
    .select('created_by')
    .eq('id', (moduleRow as { course_id: string }).course_id)
    .single();

  if (!course || (course as { created_by: string }).created_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const now = new Date().toISOString();
  const responses = body.responses ?? [];

  for (const r of responses) {
    if (!r.questionId || typeof r.manualScore !== 'number' || !Number.isFinite(r.manualScore)) continue;
    await db
      .from('external_assessment_responses')
      .update({
        manual_score: r.manualScore,
        reviewer_notes: r.reviewerNotes?.trim() || null,
        graded_at: now,
        graded_by: user.id,
        needs_manual_grade: false,
      })
      .eq('session_id', sessionId)
      .eq('question_id', r.questionId);
  }

  const passingScore = ext.passing_score ?? 70;
  let finalScore = typeof body.finalScore === 'number' && Number.isFinite(body.finalScore)
    ? Math.round(body.finalScore)
    : null;

  if (finalScore === null) {
    const { data: allResponses } = await db
      .from('external_assessment_responses')
      .select('auto_score, manual_score, max_score')
      .eq('session_id', sessionId);

    let earned = 0;
    let max = 0;
    for (const row of allResponses ?? []) {
      const r = row as { auto_score: number | null; manual_score: number | null; max_score: number | null };
      const maxPts = r.max_score ?? 0;
      max += maxPts;
      earned += r.manual_score ?? r.auto_score ?? 0;
    }
    finalScore = max > 0 ? Math.round((earned / max) * 100) : (s.auto_score != null ? Math.round(Number(s.auto_score)) : 0);
  }

  const passed =
    body.passed === true || body.passed === false ? body.passed : finalScore >= passingScore;

  await db
    .from('external_assessment_sessions')
    .update({
      status: 'graded',
      final_score: finalScore,
      passed,
      graded_at: now,
      graded_by: user.id,
      manual_grading_required: false,
      updated_at: now,
    })
    .eq('id', sessionId);

  await syncAssessmentProgress(db, {
    enrollmentId: s.enrollment_id,
    contentItemId: ext.content_item_id,
    score: finalScore,
    passed,
    markLessonComplete: passed,
  });

  return NextResponse.json({ ok: true, finalScore, passed });
}
