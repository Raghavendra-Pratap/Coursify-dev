import { NextRequest, NextResponse } from 'next/server';
import { requireInstructor } from '@/lib/instructor-auth';
import { fetchCourseInviteDetails } from '@/lib/email/fetch-course-invite-details';
import { isResendConfigured, sendInviteEmails } from '@/lib/resend-email';
import { createServerClient } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  const auth = await requireInstructor(request);
  if ('error' in auth) return auth.error;

  if (!isResendConfigured()) {
    return NextResponse.json(
      { error: 'Email not configured. Set RESEND_API_KEY in environment.' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { emails, courseId, courseTitle } = body as {
      emails?: string[];
      courseId?: string;
      courseTitle?: string;
    };

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: 'emails array is required' }, { status: 400 });
    }

    let inviterName: string | undefined;
    try {
      const db = createServerClient();
      const { data: profile } = await db
        .from('user_profiles')
        .select('full_name')
        .eq('id', auth.user.id)
        .maybeSingle();
      inviterName = (profile as { full_name?: string | null } | null)?.full_name?.trim() || undefined;
    } catch {
      inviterName = auth.user.email?.split('@')[0];
    }

    const resolvedCourseId = typeof courseId === 'string' ? courseId : undefined;
    const courseDetails = resolvedCourseId
      ? await fetchCourseInviteDetails(resolvedCourseId, inviterName)
      : null;

    let resolvedTitle = courseDetails?.courseTitle ?? (typeof courseTitle === 'string' ? courseTitle : undefined);
    if (resolvedCourseId && !courseDetails && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const db = createServerClient();
        const { data } = await db.from('courses').select('title').eq('id', resolvedCourseId).maybeSingle();
        resolvedTitle = (data as { title?: string } | null)?.title ?? resolvedTitle;
      } catch {
        // optional
      }
    }

    const { sent, failed } = await sendInviteEmails({
      emails,
      courseId: resolvedCourseId,
      courseTitle: resolvedTitle,
      inviterName,
      courseDetails,
    });

    if (sent === 0) {
      return NextResponse.json(
        { error: failed.length ? 'Failed to send all invite emails' : 'No valid email addresses', failed },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      sent,
      failed: failed.length ? failed : undefined,
      courseStats: courseDetails
        ? {
            
            moduleCount: courseDetails.moduleCount,
            lessonCount: courseDetails.lessonCount,
            durationLabel: courseDetails.durationLabel,
          }
        : undefined,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to send invite emails';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
