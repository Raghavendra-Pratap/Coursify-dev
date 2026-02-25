import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createServerClient } from '@/lib/supabase';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const fromEmail = process.env.RESEND_FROM_EMAIL || 'Coursify <onboarding@resend.dev>';
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function POST(request: NextRequest) {
  if (!resend) {
    return NextResponse.json(
      { error: 'Email not configured. Set RESEND_API_KEY in environment.' },
      { status: 503 }
    );
  }
  try {
    const body = await request.json();
    const { toEmail, userId, learnerName, note } = body as { toEmail?: string; userId?: string; learnerName?: string; note?: string };
    let email: string | null = typeof toEmail === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail) ? toEmail : null;
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
    const name = learnerName || 'Learner';
    const customNote = note ? `<p>Note: ${note}</p>` : '';
    const html = `
      <p>Hi ${name},</p>
      <p>This is a friendly reminder to continue your learning on Coursify.</p>
      ${customNote}
      <p><a href="${appUrl}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">Go to Coursify</a></p>
      <p>— Coursify LMS</p>
    `;
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: 'Reminder: Continue your learning on Coursify',
      html,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id: data?.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to send reminder email';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
