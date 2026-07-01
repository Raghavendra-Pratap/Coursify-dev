import { Resend } from 'resend';
import {
  buildBoardingPassInviteSubject,
  buildBoardingPassInviteText,
  buildInviteEmailHtml,
  courseInviteUrl,
  normalizeInviteCustomMessage,
} from '@/lib/email/boarding-pass-invite';
import type { CourseInviteDetails } from '@/lib/email/fetch-course-invite-details';
import type { ProgramInviteDetails } from '@/lib/email/fetch-program-invite-details';
import { buildMagicGoUrl } from '@/lib/magic-link';
import { lookupRecipientDisplayNames } from '@/lib/email/lookup-recipient-name';
import { runtimeEnv } from '@/lib/runtime-env';

const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

/** Read Resend API key at runtime (Docker injects .env.production when the container is created). */
export function getResendApiKey(): string | undefined {
  return runtimeEnv('RESEND_API_KEY');
}

export function isResendConfigured(): boolean {
  return Boolean(getResendApiKey());
}

export function getResendClient(): Resend | null {
  const key = getResendApiKey();
  return key ? new Resend(key) : null;
}

export function getFromEmail(): string {
  return runtimeEnv('RESEND_FROM_EMAIL') || 'Coursify <onboarding@resend.dev>';
}

export function buildLearnerInviteEmail(options: {
  courseTitle?: string;
  courseId?: string;
  inviterName?: string;
  recipientEmail: string;
  recipientName?: string;
  customMessage?: string;
  moduleCount?: number;
  lessonCount?: number;
  durationLabel?: string;
  avgRating?: number;
  ratingCount?: number;
  description?: string | null;
}): { subject: string; text: string; html: string } {
  const {
    courseTitle,
    courseId,
    inviterName,
    recipientEmail,
    recipientName,
    customMessage,
    moduleCount,
    lessonCount,
    durationLabel,
    avgRating,
    ratingCount,
    description,
  } = options;
  const ctaHref = courseId ? courseInviteUrl(courseId, appUrl) : appUrl;
  const inviteOptions = {
    recipientEmail,
    recipientName,
    courseTitle,
    courseId,
    description,
    inviterName,
    enrollUrl: ctaHref,
    customMessage: normalizeInviteCustomMessage(customMessage),
    moduleCount,
    lessonCount,
    durationLabel,
    avgRating,
    ratingCount,
  };

  return {
    subject: buildBoardingPassInviteSubject(courseTitle, inviterName),
    text: buildBoardingPassInviteText(inviteOptions),
    html: buildInviteEmailHtml(inviteOptions),
  };
}
export function buildReminderEmail(options: {
  learnerName?: string;
  note?: string;
}): { subject: string; text: string } {
  const name = options.learnerName?.trim() || 'there';
  const note = options.note?.trim();
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
    text: textLines.join('\n'),
  };
}

export function buildCollaboratorInviteEmail(options: {
  courseTitle: string;
  inviterName?: string;
  courseId: string;
}): { subject: string; text: string } {
  const inviter = options.inviterName?.trim() || 'A course owner';
  const editHref = `${appUrl}/login?view=create&course=${encodeURIComponent(options.courseId)}&landing=instructor`;
  const courseTitle = options.courseTitle;

  return {
    subject: `${inviter} added you as co-instructor on ${courseTitle}`,
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
  const explicit = runtimeEnv('RESEND_REPLY_TO');
  if (explicit) return explicit;
  const from = runtimeEnv('RESEND_FROM_EMAIL');
  const match = from?.match(/<([^>]+)>/);
  return match?.[1];
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
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
    text: options.text,
    ...(options.html ? { html: options.html } : {}),
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
  customMessage?: string;
}): Promise<{ sent: number; failed: string[] }> {
  const valid = options.emails.filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  if (valid.length === 0) throw new Error('No valid email addresses');

  const courseTitle = options.courseDetails?.courseTitle ?? options.courseTitle;
  const inviterName = options.courseDetails?.inviterName ?? options.inviterName;
  const recipientNames = await lookupRecipientDisplayNames(valid);

  let sent = 0;
  const failed: string[] = [];
  for (const to of valid) {
    try {
      const { subject, text, html } = buildLearnerInviteEmail({
        courseTitle,
        courseId: options.courseId,
        inviterName,
        recipientEmail: to,
        recipientName: recipientNames.get(to.trim().toLowerCase()),
        customMessage: options.customMessage,
        moduleCount: options.courseDetails?.moduleCount,
        lessonCount: options.courseDetails?.lessonCount,
        durationLabel: options.courseDetails?.durationLabel,
        avgRating: options.courseDetails?.avgRating,
        ratingCount: options.courseDetails?.ratingCount,
      });
      await sendEmail({ to, subject, text, html });
      sent++;
    } catch {
      failed.push(to);
    }
  }
  return { sent, failed };
}

/** One email per recipient listing all courses (group / program invite) — transactional template. */
export async function sendMultiCourseInviteEmails(options: {
  emails: string[];
  courseTitles: string[];
  programId?: string;
  programTitle?: string;
  inviterName?: string;
  customMessage?: string;
  programDetails?: ProgramInviteDetails | null;
}): Promise<{ sent: number; failed: string[] }> {
  const valid = options.emails.filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  if (valid.length === 0) throw new Error('No valid email addresses');
  if (options.courseTitles.length === 0) throw new Error('No courses selected');

  const programTitle = options.programTitle?.trim() || options.programDetails?.programTitle;
  const recipientNames = await lookupRecipientDisplayNames(valid);
  const enrollUrl = options.programId
    ? buildMagicGoUrl('program', options.programId, appUrl)
    : appUrl;

  let sent = 0;
  const failed: string[] = [];
  for (const to of valid) {
    try {
      const inviteOptions = {
        recipientEmail: to,
        recipientName: recipientNames.get(to.trim().toLowerCase()),
        courseTitle: programTitle,
        courseId: options.programId,
        description: options.programDetails?.description,
        inviterName: options.programDetails?.inviterName ?? options.inviterName,
        enrollUrl,
        customMessage: normalizeInviteCustomMessage(options.customMessage),
        moduleCount: options.programDetails?.moduleCount,
        lessonCount: options.programDetails?.lessonCount,
        durationLabel: options.programDetails?.durationLabel,
        programCourseTitles: options.courseTitles,
      };
      const subject = buildBoardingPassInviteSubject(programTitle, inviteOptions.inviterName, true);
      const text = buildBoardingPassInviteText(inviteOptions);
      const html = buildInviteEmailHtml(inviteOptions);
      await sendEmail({ to, subject, text, html });
      sent++;
    } catch {
      failed.push(to);
    }
  }
  return { sent, failed };
}
