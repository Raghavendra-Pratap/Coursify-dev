import { NextResponse } from 'next/server';
import { requireLearner } from '@/lib/learning-auth';
import {
  createProctoredInvitation,
  isAssessmentProConfigured,
  launchEmbedAssessment,
  probeEmbedFraming,
} from '@/lib/assessment-pro';
import { isAssessmentEmbedUrl } from '@/lib/assessment-url';

type ExtAssessment = {
  id: string;
  access_mode: 'lms_embed' | 'proctored_portal';
  assessment_pro_assessment_id: string;
  passing_score: number | null;
  title: string | null;
};

type DbSession = {
  id: string;
  status: string;
  embed_url: string | null;
  take_url: string | null;
  assessment_pro_invitation_id: string | null;
};

async function createProctoredLaunch(
  ext: ExtAssessment,
  enrollmentId: string,
  contentItemId: string,
  courseId: string,
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> },
  db: import('@supabase/supabase-js').SupabaseClient,
  session: DbSession | null
) {
  if (session?.take_url && ['in_progress', 'submitted', 'pending_manual_grade', 'graded'].includes(session.status)) {
    return NextResponse.json({
      sessionId: session.id,
      status: session.status,
      takeUrl: session.take_url,
      openInNewTab: true,
      title: ext.title,
      graderUrl: session.assessment_pro_invitation_id
        ? `${process.env.ASSESSMENT_PRO_BASE_URL?.replace(/\/+$/, '')}/${process.env.ASSESSMENT_PRO_COMPANY_SLUG || 'coursify-main'}/grade/${session.assessment_pro_invitation_id}`
        : undefined,
    });
  }

  if (!isAssessmentProConfigured()) {
    return NextResponse.json(
      { error: 'Assessment Pro is not configured. Set ASSESSMENT_PRO_BASE_URL and ASSESSMENT_PRO_API_KEY.' },
      { status: 503 }
    );
  }

  const learnerEmail = user.email ?? '';
  const learnerName =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    learnerEmail.split('@')[0] ||
    'Learner';

  const invite = await createProctoredInvitation({
    assessmentId: ext.assessment_pro_assessment_id,
    email: learnerEmail,
    candidateName: learnerName,
    externalRef: {
      enrollmentId,
      contentItemId,
      courseId,
      coursifyUserId: user.id,
    },
  });

  const sessionPayload = {
    enrollment_id: enrollmentId,
    external_assessment_id: ext.id,
    assessment_pro_invitation_id: invite.invitation.id,
    candidate_token: invite.invitation.token ?? null,
    take_url: invite.takeUrl,
    status: 'in_progress',
    updated_at: new Date().toISOString(),
  };

  if (session?.id) {
    await db.from('external_assessment_sessions').update(sessionPayload).eq('id', session.id);
  } else {
    await db.from('external_assessment_sessions').insert(sessionPayload);
  }

  const { data: updatedSession } = await db
    .from('external_assessment_sessions')
    .select('id')
    .eq('enrollment_id', enrollmentId)
    .eq('external_assessment_id', ext.id)
    .single();

  return NextResponse.json({
    sessionId: (updatedSession as { id: string } | null)?.id ?? session?.id,
    takeUrl: invite.takeUrl,
    openInNewTab: true,
    title: ext.title,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ courseId: string; contentItemId: string }> }
) {
  const { courseId, contentItemId } = await params;
  if (!courseId || !contentItemId) {
    return NextResponse.json({ error: 'Course ID and content item ID required' }, { status: 400 });
  }

  const auth = await requireLearner(request, courseId);
  if ('error' in auth) return auth.error;

  const { user, enrollment, db } = auth;

  const { data: extAssessment, error: extErr } = await db
    .from('external_assessments')
    .select('id, access_mode, assessment_pro_assessment_id, passing_score, title')
    .eq('content_item_id', contentItemId)
    .maybeSingle();

  if (extErr || !extAssessment) {
    return NextResponse.json({ error: 'Assessment not found for this content item' }, { status: 404 });
  }

  const ext = extAssessment as ExtAssessment;

  const { data: existingSession } = await db
    .from('external_assessment_sessions')
    .select('*')
    .eq('enrollment_id', enrollment.id)
    .eq('external_assessment_id', ext.id)
    .maybeSingle();

  const session = existingSession as DbSession | null;

  // Final exam only — module quiz stays in-lesson (embed + optional sheet new-tab fallback).
  if (ext.access_mode === 'proctored_portal') {
    try {
      return await createProctoredLaunch(ext, enrollment.id, contentItemId, courseId, user, db, session);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invitation failed';
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  if (session?.status === 'graded' || session?.status === 'pending_manual_grade') {
    return NextResponse.json({
      sessionId: session.id,
      status: session.status,
      embedUrl: session.embed_url,
      alreadySubmitted: true,
    });
  }

  if (session?.status === 'in_progress' && session.embed_url && isAssessmentEmbedUrl(session.embed_url)) {
    const framing = await probeEmbedFraming(session.embed_url);
    const embedBlocked = !framing.iframeAllowed;
    return NextResponse.json({
      sessionId: session.id,
      status: session.status,
      embedUrl: session.embed_url,
      takeUrl: embedBlocked ? session.embed_url : undefined,
      openInNewTab: embedBlocked,
      embedBlocked,
    });
  }

  if (session?.status === 'in_progress' && session.embed_url && !isAssessmentEmbedUrl(session.embed_url)) {
    await db
      .from('external_assessment_sessions')
      .update({ embed_url: null, status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', session.id);
  }

  if (!isAssessmentProConfigured()) {
    return NextResponse.json(
      { error: 'Assessment Pro is not configured. Set ASSESSMENT_PRO_BASE_URL and ASSESSMENT_PRO_API_KEY.' },
      { status: 503 }
    );
  }

  const learnerEmail = user.email ?? '';
  const learnerName =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    learnerEmail.split('@')[0] ||
    'Learner';

  try {
    const parentOrigin = new URL(request.url).origin;
    const launch = await launchEmbedAssessment({
      assessmentId: ext.assessment_pro_assessment_id,
      learner: {
        email: learnerEmail,
        name: learnerName,
        externalUserId: user.id,
      },
      externalRef: {
        enrollmentId: enrollment.id,
        contentItemId,
        courseId,
        coursifyUserId: user.id,
      },
      parentOrigin,
    });

    if (!isAssessmentEmbedUrl(launch.embedUrl)) {
      const sessionPayload = {
        enrollment_id: enrollment.id,
        external_assessment_id: ext.id,
        assessment_pro_session_id: launch.sessionId,
        launch_token: launch.launchToken,
        take_url: launch.embedUrl,
        status: 'in_progress',
        updated_at: new Date().toISOString(),
      };

      if (session?.id) {
        await db.from('external_assessment_sessions').update(sessionPayload).eq('id', session.id);
      } else {
        await db.from('external_assessment_sessions').insert(sessionPayload);
      }

      const { data: updatedSession } = await db
        .from('external_assessment_sessions')
        .select('id')
        .eq('enrollment_id', enrollment.id)
        .eq('external_assessment_id', ext.id)
        .single();

      return NextResponse.json({
        sessionId: (updatedSession as { id: string } | null)?.id ?? session?.id,
        takeUrl: launch.embedUrl,
        openInNewTab: true,
        sheetFallback: true,
        title: ext.title,
      });
    }

    const framing = await probeEmbedFraming(launch.embedUrl);
    const embedBlocked = !framing.iframeAllowed;

    const sessionPayload = {
      enrollment_id: enrollment.id,
      external_assessment_id: ext.id,
      assessment_pro_session_id: launch.sessionId,
      launch_token: launch.launchToken,
      embed_url: launch.embedUrl,
      status: 'in_progress',
      updated_at: new Date().toISOString(),
    };

    if (session?.id) {
      await db.from('external_assessment_sessions').update(sessionPayload).eq('id', session.id);
    } else {
      await db.from('external_assessment_sessions').insert(sessionPayload);
    }

    const { data: updatedSession } = await db
      .from('external_assessment_sessions')
      .select('id')
      .eq('enrollment_id', enrollment.id)
      .eq('external_assessment_id', ext.id)
      .single();

    return NextResponse.json({
      sessionId: (updatedSession as { id: string } | null)?.id ?? session?.id,
      embedUrl: launch.embedUrl,
      takeUrl: embedBlocked ? launch.embedUrl : undefined,
      expiresAt: launch.expiresAt,
      openInNewTab: embedBlocked,
      embedBlocked,
      title: ext.title,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Launch failed';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
