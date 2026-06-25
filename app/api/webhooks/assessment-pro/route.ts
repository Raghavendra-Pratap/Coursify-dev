/**
 * POST: Receive Assessment Pro session events (submit / graded).
 * Security: Bearer secret, rate limit, idempotent event keys.
 */
import { NextResponse } from 'next/server';
import { createServerClient as createServiceClient } from '@/lib/supabase';
import { syncAssessmentProgress } from '@/lib/assessment-progress';

const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX = 30;
const rateMap = new Map<string, { count: number; resetAt: number }>();

function rateLimit(key: string): boolean {
  const now = Date.now();
  const cur = rateMap.get(key);
  if (!cur) {
    rateMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (now >= cur.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  cur.count += 1;
  return cur.count > RATE_LIMIT_MAX;
}

type WebhookBody = {
  event?: string;
  accessMode?: string;
  externalRef?: {
    enrollmentId?: string;
    contentItemId?: string;
    courseId?: string;
    coursifyUserId?: string;
  };
  sessionId?: string;
  invitationId?: string;
  status?: string;
  autoScore?: number | null;
  finalScore?: number | null;
  passed?: boolean | null;
  manualGradingRequired?: boolean;
  gradedAt?: string;
  responses?: Array<{
    questionId: string;
    type: string;
    answer: unknown;
    autoScore?: number | null;
    maxScore?: number | null;
    needsManualGrade?: boolean;
  }>;
};

export async function POST(request: Request) {
  const clientId = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
  if (rateLimit(clientId)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const secret = process.env.ASSESSMENT_PRO_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: WebhookBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const event = body.event;
  const externalRef = body.externalRef;
  const enrollmentId = externalRef?.enrollmentId;
  const contentItemId = externalRef?.contentItemId;

  if (!event || !enrollmentId || !contentItemId) {
    return NextResponse.json({ error: 'event and externalRef.enrollmentId/contentItemId required' }, { status: 400 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const db = createServiceClient();
  const eventKey = `${body.sessionId ?? body.invitationId ?? 'unknown'}:${event}`;

  const { data: existingEvent } = await db
    .from('webhook_assessment_events')
    .select('event_key')
    .eq('event_key', eventKey)
    .maybeSingle();
  if (existingEvent) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const { data: extAssessment } = await db
    .from('external_assessments')
    .select('id, access_mode, passing_score')
    .eq('content_item_id', contentItemId)
    .maybeSingle();

  if (!extAssessment) {
    return NextResponse.json({ error: 'External assessment not found' }, { status: 400 });
  }

  const ext = extAssessment as { id: string; access_mode: string; passing_score: number | null };

  const { data: sessionRow } = await db
    .from('external_assessment_sessions')
    .select('id')
    .eq('enrollment_id', enrollmentId)
    .eq('external_assessment_id', ext.id)
    .maybeSingle();

  let sessionId = (sessionRow as { id: string } | null)?.id;

  if (!sessionId) {
    const { data: inserted } = await db
      .from('external_assessment_sessions')
      .insert({
        enrollment_id: enrollmentId,
        external_assessment_id: ext.id,
        assessment_pro_session_id: body.sessionId ?? null,
        assessment_pro_invitation_id: body.invitationId ?? null,
        status: 'in_progress',
      })
      .select('id')
      .single();
    sessionId = (inserted as { id: string } | null)?.id;
  }

  if (!sessionId) {
    return NextResponse.json({ error: 'Failed to resolve session' }, { status: 500 });
  }

  const accessMode = body.accessMode ?? ext.access_mode;

  if (event === 'session.submitted' && accessMode === 'lms_embed') {
    const manualRequired = body.manualGradingRequired === true;
    const finalScore =
      typeof body.finalScore === 'number' && Number.isFinite(body.finalScore)
        ? Math.round(body.finalScore)
        : typeof body.autoScore === 'number' && Number.isFinite(body.autoScore)
          ? Math.round(body.autoScore)
          : null;

    const passingScore = ext.passing_score ?? 70;
    const passed =
      manualRequired || finalScore === null
        ? null
        : body.passed === true || body.passed === false
          ? body.passed
          : finalScore >= passingScore;

    if (Array.isArray(body.responses) && body.responses.length > 0) {
      for (const r of body.responses) {
        if (!r.questionId) continue;
        await db.from('external_assessment_responses').upsert(
          {
            session_id: sessionId,
            question_id: r.questionId,
            question_type: r.type ?? 'unknown',
            answer: r.answer ?? {},
            auto_score: r.autoScore ?? null,
            max_score: r.maxScore ?? null,
            needs_manual_grade: r.needsManualGrade === true,
          },
          { onConflict: 'session_id,question_id' }
        );
      }
    }

    await db
      .from('external_assessment_sessions')
      .update({
        assessment_pro_session_id: body.sessionId ?? null,
        status: manualRequired ? 'pending_manual_grade' : 'graded',
        auto_score: body.autoScore ?? null,
        final_score: manualRequired ? null : finalScore,
        passed: manualRequired ? null : passed,
        manual_grading_required: manualRequired,
        graded_at: manualRequired ? null : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (!manualRequired && finalScore !== null && passed !== null) {
      await syncAssessmentProgress(db, {
        enrollmentId,
        contentItemId,
        score: finalScore,
        passed,
        markLessonComplete: passed,
      });
    }
  } else if (event === 'session.submitted' && accessMode === 'proctored_portal') {
    await db
      .from('external_assessment_sessions')
      .update({
        assessment_pro_session_id: body.sessionId ?? null,
        assessment_pro_invitation_id: body.invitationId ?? null,
        status: 'submitted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);
  } else if (event === 'session.graded' && accessMode === 'proctored_portal') {
    const finalScore =
      typeof body.finalScore === 'number' && Number.isFinite(body.finalScore)
        ? Math.round(body.finalScore)
        : null;
    const passingScore = ext.passing_score ?? 70;
    const passed =
      body.passed === true || body.passed === false
        ? body.passed
        : finalScore !== null
          ? finalScore >= passingScore
          : false;

    await db
      .from('external_assessment_sessions')
      .update({
        status: 'graded',
        final_score: finalScore,
        passed,
        graded_at: body.gradedAt ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (finalScore !== null) {
      await syncAssessmentProgress(db, {
        enrollmentId,
        contentItemId,
        score: finalScore,
        passed,
        markLessonComplete: passed,
      });
    }
  } else {
    return NextResponse.json({ error: 'Unsupported event or access mode' }, { status: 400 });
  }

  await db.from('webhook_assessment_events').insert({ event_key: eventKey });

  return NextResponse.json({ ok: true });
}
