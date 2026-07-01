import { NextRequest, NextResponse } from 'next/server';
import { requireInstructor } from '@/lib/instructor-auth';
import { fetchCourseInviteDetails } from '@/lib/email/fetch-course-invite-details';
import { fetchProgramInviteDetails } from '@/lib/email/fetch-program-invite-details';
import { isResendConfigured, sendInviteEmails, sendMultiCourseInviteEmails } from '@/lib/resend-email';
import { createServerClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

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
    const { emails, courseId, courseIds, programId, programTitle, courseTitle, customMessage } = body as {
      emails?: string[];
      courseId?: string;
      courseIds?: string[];
      programId?: string;
      programTitle?: string;
      courseTitle?: string;
      customMessage?: string;
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


    if (typeof programId === 'string' && programId.length > 0) {
      const db = createServerClient();
      const { data: program, error: progErr } = await db
        .from('course_programs')
        .select('id, title, created_by')
        .eq('id', programId)
        .maybeSingle();
      if (progErr || !program || (program as { created_by: string }).created_by !== auth.user.id) {
        return NextResponse.json({ error: 'Program not found' }, { status: 404 });
      }
      const { data: members, error: memErr } = await db
        .from('course_program_members')
        .select('course_id, order_index, courses(title)')
        .eq('program_id', programId)
        .order('order_index');
      if (memErr) {
        return NextResponse.json({ error: memErr.message }, { status: 500 });
      }
      const courseTitles = (members ?? [])
        .map((m) => {
          const c = (m as { courses?: { title?: string } | { title?: string }[] | null }).courses;
          if (Array.isArray(c)) return c[0]?.title;
          return c?.title;
        })
        .filter((t): t is string => typeof t === 'string' && t.length > 0);
      if (courseTitles.length === 0) {
        return NextResponse.json({ error: 'Program has no courses' }, { status: 400 });
      }
      let inviterNameProgram: string | undefined;
      try {
        const { data: profile } = await db
          .from('user_profiles')
          .select('full_name')
          .eq('id', auth.user.id)
          .maybeSingle();
        inviterNameProgram = (profile as { full_name?: string | null } | null)?.full_name?.trim() || undefined;
      } catch {
        inviterNameProgram = auth.user.email?.split('@')[0];
      }
      const resolvedProgramTitle = typeof programTitle === 'string' && programTitle.trim()
          ? programTitle.trim()
          : (program as { title: string }).title;
      const programDetails = await fetchProgramInviteDetails(programId, inviterNameProgram);
      const { sent, failed } = await sendMultiCourseInviteEmails({
        emails,
        courseTitles,
        programId,
        programTitle: resolvedProgramTitle,
        inviterName: inviterNameProgram,
        customMessage: typeof customMessage === 'string' ? customMessage : undefined,
        programDetails,
      });
      if (sent === 0) {
        return NextResponse.json(
          { error: failed.length ? 'Failed to send all invite emails' : 'No valid email addresses', failed },
          { status: 500 },
        );
      }
      return NextResponse.json({
        ok: true,
        sent,
        failed: failed.length ? failed : undefined,
        courseCount: courseTitles.length,
        programId,
      });
    }

    const resolvedCourseIds = Array.isArray(courseIds)
      ? courseIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : typeof courseId === 'string' && courseId
        ? [courseId]
        : [];

    if (resolvedCourseIds.length > 1) {
      const db = createServerClient();
      const { data: courseRows } = await db
        .from('courses')
        .select('id, title')
        .in('id', resolvedCourseIds);
      const titleById = new Map(
        (courseRows ?? []).map((c: { id: string; title: string }) => [c.id, c.title]),
      );
      const courseTitles = resolvedCourseIds
        .map((id) => titleById.get(id))
        .filter((t): t is string => typeof t === 'string' && t.length > 0);

      let inviterNameMulti: string | undefined;
      try {
        const { data: profile } = await db
          .from('user_profiles')
          .select('full_name')
          .eq('id', auth.user.id)
          .maybeSingle();
        inviterNameMulti = (profile as { full_name?: string | null } | null)?.full_name?.trim() || undefined;
      } catch {
        inviterNameMulti = auth.user.email?.split('@')[0];
      }

      const { sent, failed } = await sendMultiCourseInviteEmails({
        emails,
        courseTitles,
        inviterName: inviterNameMulti,
        customMessage: typeof customMessage === 'string' ? customMessage : undefined,
      });

      if (sent === 0) {
        return NextResponse.json(
          { error: failed.length ? 'Failed to send all invite emails' : 'No valid email addresses', failed },
          { status: 500 },
        );
      }

      return NextResponse.json({
        ok: true,
        sent,
        failed: failed.length ? failed : undefined,
        courseCount: courseTitles.length,
      });
    }

    const resolvedCourseId = resolvedCourseIds[0];
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
      customMessage: typeof customMessage === 'string' ? customMessage : undefined,
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
