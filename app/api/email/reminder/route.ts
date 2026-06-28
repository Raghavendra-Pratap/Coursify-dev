import { NextRequest, NextResponse } from 'next/server';
import { requireInstructor } from '@/lib/instructor-auth';
import { buildReminderEmail, isResendConfigured, sendEmail } from '@/lib/resend-email';
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
    const { toEmail, userId, learnerName, note } = body as {
      toEmail?: string;
      userId?: string;
      learnerName?: string;
      note?: string;
    };

    let email: string | null =
      typeof toEmail === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail) ? toEmail : null;

    if (!email && userId && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const admin = createServerClient();
        const { data: { user } } = await admin.auth.admin.getUserById(userId);
        if (user?.email) email = user.email;
      } catch {
        // ignore
      }
    }

    if (!email) {
      return NextResponse.json(
        { error: 'Provide toEmail or userId (with SUPABASE_SERVICE_ROLE_KEY to resolve email).' },
        { status: 400 }
      );
    }

    const { subject, html } = buildReminderEmail({ learnerName, note });
    const { id } = await sendEmail({ to: email, subject, html });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to send reminder email';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
