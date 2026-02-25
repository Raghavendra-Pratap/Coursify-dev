import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

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
    const { emails, courseTitle } = body as { emails?: string[]; courseId?: string; courseTitle?: string };
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: 'emails array is required' }, { status: 400 });
    }
    const courseLabel = courseTitle ? ` for "${courseTitle}"` : '';
    const subject = courseTitle ? `You're invited to "${courseTitle}" on Coursify` : "You're invited to Coursify";
    const html = `
      <p>You've been invited to join Coursify${courseLabel}.</p>
      <p>Sign up or sign in to start learning:</p>
      <p><a href="${appUrl}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">Open Coursify</a></p>
      <p>If you have any questions, reply to this email.</p>
      <p>— Coursify LMS</p>
    `;
    const toAddresses = emails.filter((e: string) => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (toAddresses.length === 0) {
      return NextResponse.json({ error: 'No valid email addresses' }, { status: 400 });
    }
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: toAddresses,
      subject,
      html,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, sent: toAddresses.length, id: data?.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to send invite emails';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
