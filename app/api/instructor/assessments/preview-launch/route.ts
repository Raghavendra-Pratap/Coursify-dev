import { NextResponse } from 'next/server';
import { requireInstructor } from '@/lib/instructor-auth';
import {
  createProctoredInvitation,
  isAssessmentProConfigured,
  launchEmbedAssessment,
  probeEmbedFraming,
} from '@/lib/assessment-pro';
import { isAssessmentEmbedUrl } from '@/lib/assessment-url';

/** Fixed preview refs — not persisted in Coursify; webhooks no-op without matching content items. */
const PREVIEW_ENROLLMENT_ID = '00000000-0000-4000-8000-000000000001';
const PREVIEW_COURSE_ID = '00000000-0000-4000-8000-000000000002';

export async function POST(request: Request) {
  const auth = await requireInstructor(request);
  if ('error' in auth) return auth.error;

  const { user } = auth;

  let body: { assessmentProId?: string; accessMode?: string; title?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const assessmentProId = body.assessmentProId?.trim();
  if (!assessmentProId || !/^[0-9a-f-]{36}$/i.test(assessmentProId)) {
    return NextResponse.json({ error: 'Valid assessmentProId (UUID) is required' }, { status: 400 });
  }

  const accessMode = body.accessMode === 'proctored_portal' ? 'proctored_portal' : 'lms_embed';

  if (!isAssessmentProConfigured()) {
    return NextResponse.json(
      { error: 'Assessment Pro is not configured. Set ASSESSMENT_PRO_BASE_URL and ASSESSMENT_PRO_API_KEY.' },
      { status: 503 }
    );
  }

  const email = user.email ?? 'instructor-preview@coursify.local';
  const name =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    email.split('@')[0] ||
    'Instructor';

  const parentOrigin = new URL(request.url).origin;
  const previewContentItemId = assessmentProId;

  try {
    if (accessMode === 'lms_embed') {
      const launch = await launchEmbedAssessment({
        assessmentId: assessmentProId,
        learner: {
          email,
          name,
          externalUserId: user.id,
        },
        externalRef: {
          enrollmentId: PREVIEW_ENROLLMENT_ID,
          contentItemId: previewContentItemId,
          courseId: PREVIEW_COURSE_ID,
          coursifyUserId: user.id,
        },
        parentOrigin,
      });

      if (!isAssessmentEmbedUrl(launch.embedUrl)) {
        return NextResponse.json({
          preview: true,
          takeUrl: launch.embedUrl,
          openInNewTab: true,
          sheetFallback: true,
          title: body.title?.trim() || undefined,
        });
      }

      const framing = await probeEmbedFraming(launch.embedUrl);
      const embedBlocked = !framing.iframeAllowed;

      return NextResponse.json({
        preview: true,
        embedUrl: launch.embedUrl,
        takeUrl: embedBlocked ? launch.embedUrl : undefined,
        openInNewTab: embedBlocked,
        embedBlocked,
        expiresAt: launch.expiresAt,
        title: body.title?.trim() || undefined,
      });
    }

    const invite = await createProctoredInvitation({
      assessmentId: assessmentProId,
      email,
      candidateName: name,
      externalRef: {
        enrollmentId: PREVIEW_ENROLLMENT_ID,
        contentItemId: previewContentItemId,
        courseId: PREVIEW_COURSE_ID,
        coursifyUserId: user.id,
      },
    });

    return NextResponse.json({
      preview: true,
      takeUrl: invite.takeUrl,
      openInNewTab: true,
      title: body.title?.trim() || undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Preview launch failed';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
