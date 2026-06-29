import { Resend } from 'resend';
import {
  buildBoardingPassInviteHtml,
  buildBoardingPassInviteSubject,
  buildBoardingPassInviteText,
} from '@/lib/email/boarding-pass-invite';
import type { CourseInviteDetails } from '@/lib/email/fetch-course-invite-details';

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

export function buildLearnerInviteEmail(options: {
  courseTitle?: string;
  courseId?: string;
  inviterName?: string;
  recipientEmail: string;
}): { subject: string; html: string; text: string } {
  const { courseTitle, courseId, inviterName, recipientEmail } = options;
  const ctaHref = courseId ? `${appUrl}?enroll=${encodeURIComponent(courseId)}` : appUrl;
  const inviteOptions = {
    recipientEmail,
    courseTitle,
    courseId,
    inviterName,
    enrollUrl: ctaHref,
  };

  return {
    subject: buildBoardingPassInviteSubject(courseTitle, inviterName),
    html: buildBoardingPassInviteHtml(inviteOptions),
    text: buildBoardingPassInviteText(inviteOptions),
  };
}
function buttonHtml(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">${label}</a>`;
}

export function buildReminderEmail(options: {
  learnerName?: string;
  note?: string;
}): { subject: string; html: string; text: string } {
  const name = options.learnerName?.trim() || 'there';
  const note = options.note?.trim();
  const noteBlock = note
    ? `<p style="margin:16px 0;padding:12px;background:#f3f4f6;border-radius:8px;">${note}</p>`
    : '';
  const textLines = [
    `Hi ${name},`,
    '',
    'This is a friendly reminder to continue your learning on Coursify.',
    ...(note ? ['', note, ''] : ['']),
    'Continue here:',
    appUrl,
    '',
    '— Coursify LMS',
  ];

  return {
    subject: 'Reminder to continue your course on Coursify',
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#111827;max-width:520px;">
        <p>Hi ${name},</p>
        <p>This is a friendly reminder to continue your learning on Coursify.</p>
        ${noteBlock}
        <p style="margin:24px 0;">${buttonHtml(appUrl, 'Continue learning')}</p>
        <p style="margin-top:24px;font-size:13px;color:#6b7280;">— Coursify LMS</p>
      </div>
    `,
    text: textLines.join('\n'),
  };
}

export function buildCollaboratorInviteEmail(options: {
  courseTitle: string;
  inviterName?: string;
  courseId: string;
}): { subject: string; html: string; text: string } {
  const inviter = options.inviterName?.trim() || 'A course owner';
  const editHref = `${appUrl}?view=create&course=${encodeURIComponent(options.courseId)}`;
  const courseTitle = options.courseTitle;

  return {
    subject: `${inviter} added you as co-instructor on ${courseTitle}`,
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#111827;max-width:520px;">
        <h2 style="margin:0 0 16px;font-size:20px;">Co-instructor access</h2>
        <p>${inviter} added you as a co-instructor on <strong>${courseTitle}</strong>.</p>
        <p>Sign in to Coursify to edit and publish the course with them.</p>
        <p style="margin:24px 0;">${buttonHtml(editHref, 'Open course editor')}</p>
        <p style="margin-top:32px;font-size:13px;color:#6b7280;">If the button doesn't work, copy this link:<br/><a href="${editHref}">${editHref}</a></p>
        <p style="margin-top:24px;font-size:13px;color:#6b7280;">— Coursify LMS</p>
      </div>
    `,
    text: [
      `${inviter} added you as a co-instructor on "${courseTitle}".`,
      '',
      'Sign in to Coursify to edit and publish the course:',
      editHref,
      '',
      '— Coursify LMS',
    ].join('\n'),
  };
}

function getReplyToEmail(): string | undefined {
  const explicit = process.env.RESEND_REPLY_TO?.trim();
  if (explicit) return explicit;
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const match = from?.match(/<([^>]+)>/);
  return match?.[1];
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ id?: string }> {
  const resend = getResendClient();
  if (!resend) {
    throw new Error('Email not configured. Set RESEND_API_KEY in environment.');
  }
  const replyTo = getReplyToEmail();
  const { data, error } = await resend.emails.send({
    from: getFromEmail(),
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    ...(replyTo ? { reply_to: replyTo } : {}),
  });
  if (error) throw new Error(error.message);
  return { id: data?.id };
}

export async function sendInviteEmails(options: {
  emails: string[];
  courseTitle?: string;
  courseId?: string;
  inviterName?: string;
  courseDetails?: CourseInviteDetails | null;
}): Promise<{ sent: number; failed: string[] }> {
  const valid = options.emails.filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  if (valid.length === 0) throw new Error('No valid email addresses');

  const courseTitle = options.courseDetails?.courseTitle ?? options.courseTitle;
  const inviterName = options.courseDetails?.inviterName ?? options.inviterName;

  let sent = 0;
  const failed: string[] = [];
  for (const to of valid) {
    try {
      const { subject, html, text } = buildLearnerInviteEmail({
        courseTitle,
        courseId: options.courseId,
        inviterName,
        recipientEmail: to,
      });
      await sendEmail({ to, subject, html, text });
      sent++;
    } catch {
      failed.push(to);
    }
  }
  return { sent, failed };
}
