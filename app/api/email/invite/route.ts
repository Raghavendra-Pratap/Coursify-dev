import { NextRequest, NextResponse } from 'next/server';
import { requireInstructor } from '@/lib/instructor-auth';
import { isResendConfigured, sendInviteEmails } from '@/lib/resend-email';
import { createServerClient } from '@/lib/supabase';

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

    let resolvedTitle = typeof courseTitle === 'string' ? courseTitle : undefined;
    if (courseId && !resolvedTitle && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const db = createServerClient();
        const { data } = await db.from('courses').select('title').eq('id', courseId).maybeSingle();
        resolvedTitle = (data as { title?: string } | null)?.title ?? undefined;
      } catch {
        // optional
      }
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

    const { sent, failed } = await sendInviteEmails({
      emails,
      courseId: typeof courseId === 'string' ? courseId : undefined,
      courseTitle: resolvedTitle,
      inviterName,
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
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to send invite emails';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
