import { Resend } from 'resend';

const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

export function getFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL || 'Coursify <onboarding@resend.dev>';
}

function buttonHtml(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">${label}</a>`;
}

export function buildLearnerInviteEmail(options: {
  courseTitle?: string;
  courseId?: string;
  inviterName?: string;
}): { subject: string; html: string } {
  const { courseTitle, courseId, inviterName } = options;
  const inviterLine = inviterName ? `<p>${inviterName} invited you to learn on Coursify.</p>` : `<p>You've been invited to learn on Coursify.</p>`;
  const courseLine = courseTitle
    ? `<p><strong>Course:</strong> ${courseTitle}</p>`
    : `<p>Sign up to access your courses.</p>`;
  const ctaHref = courseId ? `${appUrl}?enroll=${encodeURIComponent(courseId)}` : appUrl;
  const ctaLabel = courseTitle ? `Join "${courseTitle}"` : 'Open Coursify';

  const subject = courseTitle
    ? `You're invited to "${courseTitle}" on Coursify`
    : "You're invited to Coursify";

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#111827;max-width:520px;">
      <h2 style="margin:0 0 16px;font-size:20px;">You're invited</h2>
      ${inviterLine}
      ${courseLine}
      <p style="margin:24px 0;">Create an account or sign in with the same email address to get started.</p>
      <p style="margin:24px 0;">${buttonHtml(ctaHref, ctaLabel)}</p>
      <p style="margin-top:32px;font-size:13px;color:#6b7280;">If the button doesn't work, copy this link:<br/><a href="${ctaHref}">${ctaHref}</a></p>
      <p style="margin-top:24px;font-size:13px;color:#6b7280;">— Coursify LMS</p>
    </div>
  `;

  return { subject, html };
}

export function buildReminderEmail(options: {
  learnerName?: string;
  note?: string;
}): { subject: string; html: string } {
  const name = options.learnerName?.trim() || 'there';
  const noteBlock = options.note
    ? `<p style="margin:16px 0;padding:12px;background:#f3f4f6;border-radius:8px;">${options.note}</p>`
    : '';

  return {
    subject: 'Reminder: continue your learning on Coursify',
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#111827;max-width:520px;">
        <p>Hi ${name},</p>
        <p>This is a friendly reminder to continue your learning on Coursify.</p>
        ${noteBlock}
        <p style="margin:24px 0;">${buttonHtml(appUrl, 'Continue learning')}</p>
        <p style="margin-top:24px;font-size:13px;color:#6b7280;">— Coursify LMS</p>
      </div>
    `,
  };
}

export function buildCollaboratorInviteEmail(options: {
  courseTitle: string;
  inviterName?: string;
  courseId: string;
}): { subject: string; html: string } {
  const inviter = options.inviterName?.trim() || 'A course owner';
  const editHref = `${appUrl}?view=create&course=${encodeURIComponent(options.courseId)}`;

  return {
    subject: `You're a co-instructor on "${options.courseTitle}"`,
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#111827;max-width:520px;">
        <h2 style="margin:0 0 16px;font-size:20px;">Co-instructor access</h2>
        <p>${inviter} added you as a co-instructor on <strong>${options.courseTitle}</strong>.</p>
        <p>Sign in to Coursify to edit and publish the course with them.</p>
        <p style="margin:24px 0;">${buttonHtml(editHref, 'Open course editor')}</p>
        <p style="margin-top:32px;font-size:13px;color:#6b7280;">If the button doesn't work, copy this link:<br/><a href="${editHref}">${editHref}</a></p>
        <p style="margin-top:24px;font-size:13px;color:#6b7280;">— Coursify LMS</p>
      </div>
    `,
  };
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ id?: string }> {
  const resend = getResendClient();
  if (!resend) {
    throw new Error('Email not configured. Set RESEND_API_KEY in environment.');
  }
  const { data, error } = await resend.emails.send({
    from: getFromEmail(),
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
  if (error) throw new Error(error.message);
  return { id: data?.id };
}

export async function sendInviteEmails(options: {
  emails: string[];
  courseTitle?: string;
  courseId?: string;
  inviterName?: string;
}): Promise<{ sent: number; failed: string[] }> {
  const valid = options.emails.filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  if (valid.length === 0) throw new Error('No valid email addresses');

  const { subject, html } = buildLearnerInviteEmail({
    courseTitle: options.courseTitle,
    courseId: options.courseId,
    inviterName: options.inviterName,
  });

  let sent = 0;
  const failed: string[] = [];
  for (const to of valid) {
    try {
      await sendEmail({ to, subject, html });
      sent++;
    } catch {
      failed.push(to);
    }
  }
  return { sent, failed };
}
