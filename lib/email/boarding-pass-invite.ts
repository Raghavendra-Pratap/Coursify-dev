/** Invitation card HTML for learner invite emails (table layout for email clients). */

import QRCode from 'qrcode';

const COPPER = '#ff6b35';
const COPPER_LIGHT = '#ff8c5a';
const INK = '#080808';
const CARD = '#0f0f0f';
const CARD_STUB = '#141414';
const MUTED = 'rgba(255,255,255,0.35)';
const WHITE = 'rgba(255,255,255,0.88)';
const EMAIL_WIDTH = 900;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function titleCaseFromEmail(email: string): string {
  const local = email.split('@')[0] ?? 'Learner';
  return local
    .replace(/[._+-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .slice(0, 48) || 'Learner';
}

export function courseCode(courseTitle?: string, courseId?: string): string {
  if (courseTitle) {
    const parts = courseTitle
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(/\s+/)
      .filter(Boolean);
    const prefix = parts
      .slice(0, 3)
      .map((p) => p.slice(0, 1).toUpperCase())
      .join('');
    const num = courseId ? courseId.replace(/\D/g, '').slice(-3).padStart(3, '0') : '101';
    if (prefix.length >= 2) return `${prefix}-${num}`;
  }
  if (courseId) return courseId.slice(0, 8).toUpperCase();
  return 'CRS-101';
}

export function enrollmentCode(recipientEmail: string, courseId?: string): string {
  const local = recipientEmail.split('@')[0] ?? 'XX';
  const initials = local.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase() || 'XX';
  const suffix = courseId
    ? courseId.replace(/-/g, '').slice(-4).toUpperCase()
    : local.replace(/\D/g, '').slice(-4).padStart(4, '0') || '0000';
  return `${initials}-${suffix}`;
}

export function instructorInitials(name?: string): string {
  if (!name?.trim()) return '—';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}.${parts[parts.length - 1][0]}`.toUpperCase();
}

export function formatBoardingDate(date: Date): string {
  return date
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase()
    .replace(/ /g, ' ');
}

export function reserveByDate(days = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatBoardingDate(d);
}

const DESTINATION_STOP_WORDS = new Set([
  'a', 'an', 'the', 'for', 'in', 'on', 'at', 'to', 'and', 'or', 'of', 'with', 'by',
]);

/** Short destination line for boarding pass (skips filler words; uses up to 3 meaningful words). */
export function destinationLabel(courseTitle?: string): string {
  if (!courseTitle?.trim()) return 'COURSIFY';
  const words = courseTitle
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !DESTINATION_STOP_WORDS.has(w.toLowerCase()));
  if (words.length === 0) return 'LEARNING';
  if (words.length <= 3) return words.join(' ').toUpperCase();
  return words.slice(0, 3).join(' ').toUpperCase();
}

/** Public invite/enroll URL for a published course (used in QR codes and emails). */
export function courseInviteUrl(courseId: string, appBaseUrl?: string): string {
  const fromEnv = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_APP_URL)
    ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
    : '';
  const base = (appBaseUrl || fromEnv || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}/course/${encodeURIComponent(courseId)}`;
}

/** Public invite URL for a course program (track / certificate bundle). */
export function programInviteUrl(programId: string, appBaseUrl?: string): string {
  const fromEnv = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_APP_URL)
    ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
    : '';
  const base = (appBaseUrl || fromEnv || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}/program/${encodeURIComponent(programId)}`;
}

function compactGridCell(label: string, value: string, width = '25%'): string {
  return `
    <td width="${width}" style="vertical-align:top;padding:0 12px 12px 0;font-family:Arial,Helvetica,sans-serif;">
      <div style="font-size:9px;letter-spacing:0.12em;color:${MUTED};margin-bottom:4px;text-transform:uppercase;">${escapeHtml(label)}</div>
      <div style="font-size:13px;font-weight:700;color:${WHITE};letter-spacing:0.04em;">${escapeHtml(value)}</div>
    </td>`;
}

function ratingGridCell(avgRating: number, ratingCount: number): string {
  return `
    <td width="25%" style="vertical-align:top;padding:0 12px 12px 0;font-family:Arial,Helvetica,sans-serif;">
      <div style="font-size:9px;letter-spacing:0.12em;color:${MUTED};margin-bottom:4px;text-transform:uppercase;">Rating</div>
      <div style="font-size:13px;font-weight:700;color:${WHITE};letter-spacing:0.04em;">
        <span style="color:${COPPER_LIGHT};">&#9733;</span> ${avgRating.toFixed(1)}
        <span style="color:${MUTED};font-weight:400;font-size:12px;"> (${ratingCount})</span>
      </div>
    </td>`;
}

async function buildQrImgMarkup(url: string): Promise<string> {
  try {
    const dataUri = await QRCode.toDataURL(url, {
      width: 108,
      margin: 1,
      color: { dark: INK, light: '#FFFFFF' },
    });
    return `<img src="${dataUri}" width="108" height="108" alt="Course invitation QR code" style="display:block;background:#FFFFFF;border-radius:8px;padding:10px;" />`;
  } catch {
    return `<div style="width:108px;height:108px;background:#FFFFFF;border-radius:8px;"></div>`;
  }
}

export type BoardingPassInviteOptions = {
  recipientEmail: string;
  recipientName?: string;
  courseTitle?: string;
  courseId?: string;
  description?: string | null;
  inviterName?: string;
  enrollUrl: string;
  reserveDays?: number;
  moduleCount?: number;
  lessonCount?: number;
  durationLabel?: string;
  avgRating?: number;
  ratingCount?: number;
  /** Optional personal note from the course creator (shown above the boarding pass). */
  customMessage?: string;
  /** When set, renders as a multi-course program invite. */
  programCourseTitles?: string[];
};

const MAX_CUSTOM_MESSAGE_LENGTH = 2000;

export function normalizeInviteCustomMessage(message?: string): string | undefined {
  const trimmed = message?.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_CUSTOM_MESSAGE_LENGTH);
}

const MESSAGE_BODY_STYLE = `margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:${WHITE};`;
const MESSAGE_MUTED_STYLE = `margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:${MUTED};`;

function inviteMessageParagraphsHtml(text: string): string {
  return text
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p style="${MESSAGE_BODY_STYLE}">${escapeHtml(paragraph).replace(/\n/g, '<br/>')}</p>`,
    )
    .join('');
}

function buildDefaultInviteMessageHtml(options: BoardingPassInviteOptions): string {
  const passenger = escapeHtml(options.recipientName?.trim() || titleCaseFromEmail(options.recipientEmail));
  const isProgram = (options.programCourseTitles?.length ?? 0) > 0;
  const course = escapeHtml(options.courseTitle?.trim() || (isProgram ? 'a Coursify program' : 'a Coursify course'));
  const inviter = options.inviterName?.trim();
  const recipientEmail = escapeHtml(options.recipientEmail);
  const intro = inviter
    ? isProgram
      ? `${escapeHtml(inviter)} invited you to join the program &ldquo;<span style="color:${COPPER_LIGHT};">${course}</span>&rdquo; on Coursify.`
      : `${escapeHtml(inviter)} invited you to join &ldquo;<span style="color:${COPPER_LIGHT};">${course}</span>&rdquo; on Coursify.`
    : isProgram
      ? `You have been invited to join the program &ldquo;<span style="color:${COPPER_LIGHT};">${course}</span>&rdquo; on Coursify.`
      : `You have been invited to join &ldquo;<span style="color:${COPPER_LIGHT};">${course}</span>&rdquo; on Coursify.`;

  const courseList = isProgram && options.programCourseTitles?.length
    ? `<ul style="margin:12px 0 0;padding-left:20px;color:${MUTED};font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;">
        ${options.programCourseTitles.map((t) => `<li style="margin-bottom:6px;">${escapeHtml(t)}</li>`).join('')}
      </ul>`
    : '';

  return `
    <p style="${MESSAGE_BODY_STYLE}">Hi <span style="color:${COPPER_LIGHT};">${passenger}</span>,</p>
    <p style="${MESSAGE_BODY_STYLE}">${intro}${courseList}</p>
    <p style="${MESSAGE_MUTED_STYLE}">To accept, sign in with Google using <strong style="color:${WHITE};">${recipientEmail}</strong>.</p>`;
}

function buildInviteMessageHtml(options: BoardingPassInviteOptions): string {
  const custom = normalizeInviteCustomMessage(options.customMessage);
  const inner = custom ? inviteMessageParagraphsHtml(custom) : buildDefaultInviteMessageHtml(options);
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:${EMAIL_WIDTH}px;margin:0 auto 24px;">
      <tr>
        <td style="background:${CARD};border-radius:16px;padding:24px 28px;border:1px solid #243040;">
          ${inner}
        </td>
      </tr>
    </table>`;
}

async function buildBoardingPassCardMarkup(options: BoardingPassInviteOptions): Promise<string> {
  const {
    recipientEmail,
    recipientName,
    courseTitle,
    courseId,
    description,
    inviterName,
    enrollUrl,
    reserveDays = 30,
    moduleCount,
    lessonCount,
    durationLabel,
    avgRating,
    ratingCount,
    programCourseTitles,
  } = options;

  const isProgram = (programCourseTitles?.length ?? 0) > 0;
  const passenger = escapeHtml(recipientName?.trim() || titleCaseFromEmail(recipientEmail));
  const course = escapeHtml(courseTitle?.trim() || (isProgram ? 'Coursify Program' : 'Coursify Learning'));
  const code = courseCode(courseTitle, courseId);
  const enrollCode = enrollmentCode(recipientEmail, courseId);
  const instructor = escapeHtml(instructorInitials(inviterName));
  const cohortLabel = new Date().getFullYear().toString();
  const begins = formatBoardingDate(new Date());
  const destination = escapeHtml(isProgram ? destinationLabel(courseTitle) : destinationLabel(courseTitle));
  const reserveBy = reserveByDate(reserveDays);
  const seat = enrollCode.split('-')[1]?.slice(0, 2) ?? '01';
  const qrImg = await buildQrImgMarkup(enrollUrl);

  const hasCourseStats = isProgram || moduleCount != null || lessonCount != null || durationLabel;
  const showRating = !isProgram && (ratingCount ?? 0) > 0 && avgRating != null;

  const statsRow = hasCourseStats
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:12px;font-family:Arial,Helvetica,sans-serif;">
        <tr>
          ${isProgram
            ? compactGridCell('Courses', String(programCourseTitles?.length ?? 0))
            : compactGridCell('Modules', String(moduleCount ?? 0))}
          ${compactGridCell('Lessons', String(lessonCount ?? 0))}
          ${compactGridCell('Duration', durationLabel || '0m')}
          ${showRating ? ratingGridCell(avgRating!, ratingCount!) : ''}
        </tr>
      </table>`
    : '';

  const programCoursesBlock = isProgram && programCourseTitles?.length
    ? `<div style="margin-bottom:20px;font-family:Arial,Helvetica,sans-serif;">
        <div style="font-size:9px;letter-spacing:0.12em;color:${MUTED};margin-bottom:8px;text-transform:uppercase;">Included courses</div>
        ${programCourseTitles.map((t, i) => `
          <div style="font-size:13px;color:${WHITE};margin-bottom:6px;">
            <span style="color:${COPPER_LIGHT};font-weight:700;margin-right:8px;">${i + 1}.</span>${escapeHtml(t)}
          </div>`).join('')}
      </div>`
    : '';

  const metaRow = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:Arial,Helvetica,sans-serif;">
      <tr>
        ${compactGridCell('Cohort', cohortLabel)}
        ${compactGridCell('Course', code)}
        ${compactGridCell('Seat', `${seat}A`)}
        ${compactGridCell('Instructor', instructor)}
      </tr>
    </table>`;

  const descriptionBlock = description?.trim()
    ? `<p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:${MUTED};">${escapeHtml(description.trim())}</p>`
    : '';

  const invitedByBlock = inviterName?.trim()
    ? `<div style="margin-bottom:24px;">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.12em;color:${MUTED};margin-bottom:4px;text-transform:uppercase;">Invited by</div>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:${COPPER_LIGHT};line-height:1.35;">${escapeHtml(inviterName.trim())}</div>
      </div>`
    : '';

  return `
    <tr>
      <td align="center" style="padding-bottom:20px;">
        <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.2em;color:${MUTED};text-transform:uppercase;">Coursify · Invitation</span>
      </td>
    </tr>
    <tr>
      <td>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${EMAIL_WIDTH}" style="width:100%;max-width:${EMAIL_WIDTH}px;background:${CARD};border-radius:20px;border:1px solid #243040;overflow:hidden;">
          <tr>
            <td width="74%" style="vertical-align:top;padding:36px 32px 32px 36px;background:${CARD};">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:0.18em;color:${COPPER};text-transform:uppercase;margin-bottom:12px;">${isProgram ? 'Program invitation · Coursify' : 'Invitation · Coursify'}</div>
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.15;color:${COPPER};font-weight:400;margin-bottom:4px;">${passenger}</div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${MUTED};margin-bottom:8px;">you&rsquo;re invited to join</div>
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.25;color:${COPPER_LIGHT};font-style:italic;margin-bottom:20px;">${course}</div>
              ${descriptionBlock}
              ${programCoursesBlock}

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:24px;">
                <tr>
                  <td width="42%" style="vertical-align:top;">
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.12em;color:${MUTED};margin-bottom:4px;text-transform:uppercase;">Cohort begins</div>
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;color:${WHITE};">${begins}</div>
                  </td>
                  <td width="16%" align="center" style="vertical-align:middle;">
                    <div style="width:36px;height:36px;border-radius:50%;border:1px solid ${COPPER};text-align:center;line-height:36px;color:${COPPER};font-family:Arial,Helvetica,sans-serif;font-size:16px;">&rarr;</div>
                  </td>
                  <td width="42%" style="vertical-align:top;text-align:right;">
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.12em;color:${MUTED};margin-bottom:4px;text-transform:uppercase;">Destination</div>
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;color:${WHITE};line-height:1.3;">${destination}</div>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td width="128" style="vertical-align:top;padding-right:24px;">
                    ${qrImg}
                  </td>
                  <td style="vertical-align:top;">
                    ${statsRow}
                    ${metaRow}
                  </td>
                </tr>
              </table>
            </td>

            <td width="26%" style="vertical-align:top;padding:28px 24px;background:${CARD_STUB};border-left:2px dashed #3A4A5C;">
              <div style="width:28px;height:28px;border-radius:50%;border:1px solid ${COPPER};text-align:center;line-height:28px;color:${COPPER};font-family:Arial,Helvetica,sans-serif;font-size:14px;margin-bottom:20px;">&#8599;</div>
              ${invitedByBlock}
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.12em;color:${MUTED};margin-bottom:4px;text-transform:uppercase;">${isProgram ? 'Program code' : 'Course code'}</div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;color:${WHITE};margin-bottom:28px;">${escapeHtml(code)}</div>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 24px;">
                <tr>
                  <td align="center" style="border-radius:50%;background:${COPPER};width:52px;height:52px;text-align:center;">
                    <a href="${escapeHtml(enrollUrl)}" style="display:block;width:52px;height:52px;line-height:52px;color:${INK};text-decoration:none;font-size:22px;font-weight:700;">&rarr;</a>
                  </td>
                </tr>
              </table>

              <div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.12em;color:${MUTED};margin-bottom:4px;text-transform:uppercase;">Enrollment code</div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:${COPPER_LIGHT};letter-spacing:0.08em;margin-bottom:20px;">${escapeHtml(enrollCode)}</div>

              <div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.12em;color:${MUTED};margin-bottom:4px;text-transform:uppercase;">Reserve by</div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:${WHITE};">${reserveBy}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:24px 8px 0;font-family:Arial,Helvetica,sans-serif;">
        <a href="${escapeHtml(enrollUrl)}" style="display:inline-block;padding:14px 28px;background:${COPPER};color:${INK};text-decoration:none;border-radius:999px;font-size:14px;font-weight:700;letter-spacing:0.04em;">Accept invitation &rarr;</a>
        <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:${MUTED};">
          Sign in with Google using <strong style="color:${WHITE};">${escapeHtml(recipientEmail)}</strong> to view your boarding pass and enroll.
        </p>
      </td>
    </tr>`;
}

/** Full invite email: creator message (or default intro) + boarding pass card. */
export async function buildLearnerInviteEmailHtml(options: BoardingPassInviteOptions): Promise<string> {
  const messageBlock = buildInviteMessageHtml(options);
  const cardBlock = await buildBoardingPassCardMarkup(options);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Your Coursify invitation</title>
</head>
<body style="margin:0;padding:32px 16px;background:${INK};font-family:Georgia,'Times New Roman',serif;">
  ${messageBlock}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:${EMAIL_WIDTH}px;margin:0 auto;">
    ${cardBlock}
  </table>
</body>
</html>`;
}

export async function buildBoardingPassInviteHtml(options: BoardingPassInviteOptions): Promise<string> {
  return buildLearnerInviteEmailHtml(options);
}

export function buildBoardingPassInviteSubject(courseTitle?: string, inviterName?: string, isProgram?: boolean): string {
  const course = courseTitle?.trim();
  const inviter = inviterName?.trim();
  if (inviter && course) {
    return isProgram
      ? `${inviter} invited you to ${course} on Coursify`
      : `${inviter} invited you to ${course}`;
  }
  if (course) return isProgram ? `Invitation to ${course} on Coursify` : `Invitation to ${course} on Coursify`;
  return 'Your invitation to Coursify';
}

/** Plain-text learner invite (boarding pass lives in the app). */
export function buildBoardingPassInviteText(options: BoardingPassInviteOptions): string {
  const passenger = options.recipientName?.trim() || titleCaseFromEmail(options.recipientEmail);
  const isProgram = (options.programCourseTitles?.length ?? 0) > 0;
  const course = options.courseTitle?.trim() || (isProgram ? 'a Coursify program' : 'a Coursify course');
  const inviter = options.inviterName?.trim();
  const siteHost = options.enrollUrl.replace(/^https?:\/\//, '').split('/')[0];
  const custom = normalizeInviteCustomMessage(options.customMessage);
  const reserveBy = reserveByDate(options.reserveDays ?? 30);

  const callout = custom
    || (inviter
      ? isProgram
        ? `${inviter} invited you to join a program on Coursify. Sign in with Google to accept your invitation.`
        : `${inviter} invited you to join a course on Coursify. Sign in with Google to accept your invitation.`
      : isProgram
        ? 'You have been invited to join a program on Coursify. Sign in with Google to accept your invitation.'
        : 'You have been invited to join a course on Coursify. Sign in with Google to accept your invitation.');

  const footerLine = inviter ? `Sent on behalf of ${inviter} via Coursify` : 'Sent via Coursify';

  const courseListBlock = isProgram && options.programCourseTitles?.length
    ? [
        '',
        'Included courses:',
        ...options.programCourseTitles.map((t, i) => `${i + 1}. ${t}`),
      ]
    : [];

  return [
    `Hi ${passenger},`,
    '',
    callout,
    '',
    isProgram
      ? 'You have been invited to join the program below.'
      : 'You have been invited to join the course below.',
    '',
    `${isProgram ? 'PROGRAM' : 'COURSE'}: ${course}`,
    ...courseListBlock,
    `Reserve by: ${reserveBy}`,
    '',
    'Accept invitation:',
    options.enrollUrl,
    '',
    'Before you begin:',
    `- Sign in with the Google account for ${options.recipientEmail}`,
    '- New to Coursify? Google sign-in creates your account automatically.',
    '',
    'Or copy this link:',
    options.enrollUrl,
    '',
    '---',
    '',
    'If you did not expect this invitation, you can safely ignore this email.',
    '',
    footerLine,
    siteHost,
  ].join('\n');
}

function emailBrandMarkHtml(size = 36): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 12px;">
    <tr>
      <td style="width:${size}px;height:${size}px;border-radius:8px;background:#161616;border:1px solid #242424;text-align:center;vertical-align:middle;">
        <svg width="22" height="22" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;">
          <polyline points="16,26 30,40 16,54" fill="none" stroke="#ff6b35" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
          <polyline points="32,26 46,40 32,54" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="68" cy="68" r="6" fill="#ff6b35"/>
        </svg>
      </td>
    </tr>
  </table>`;
}

/** Transactional-style invite email (course/program card + CTA button; boarding pass in app). */
export function buildInviteEmailHtml(options: BoardingPassInviteOptions): string {
  const passenger = escapeHtml(options.recipientName?.trim() || titleCaseFromEmail(options.recipientEmail));
  const isProgram = (options.programCourseTitles?.length ?? 0) > 0;
  const course = escapeHtml(options.courseTitle?.trim() || (isProgram ? 'Coursify program' : 'Coursify course'));
  const inviter = options.inviterName?.trim();
  const recipientEmail = escapeHtml(options.recipientEmail);
  const enrollUrl = escapeHtml(options.enrollUrl);
  const custom = normalizeInviteCustomMessage(options.customMessage);
  const reserveByFormatted = escapeHtml(
    new Date(Date.now() + (options.reserveDays ?? 30) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
  );

  const calloutHtml = custom
    ? escapeHtml(custom).replace(/\n/g, '<br/>')
    : inviter
      ? isProgram
        ? `${escapeHtml(inviter)} invited you to join a program on Coursify. Sign in with Google to accept your invitation.`
        : `${escapeHtml(inviter)} invited you to join a course on Coursify. Sign in with Google to accept your invitation.`
      : isProgram
        ? 'You have been invited to join a program on Coursify. Sign in with Google to accept your invitation.'
        : 'You have been invited to join a course on Coursify. Sign in with Google to accept your invitation.';

  const footerLine = inviter
    ? `Sent on behalf of ${escapeHtml(inviter)} via Coursify`
    : 'Sent via Coursify';

  const programCoursesHtml = isProgram && options.programCourseTitles?.length
    ? `<ul style="margin:16px 0 0;padding-left:20px;font-size:14px;line-height:1.7;color:#475569;">
        ${options.programCourseTitles.map((t) => `<li style="margin-bottom:6px;">${escapeHtml(t)}</li>`).join('')}
      </ul>`
    : '';

  const programStatsHtml = isProgram && (options.moduleCount != null || options.lessonCount != null || options.durationLabel)
    ? `<p style="margin:12px 0 0;font-size:14px;color:#64748b;">
        ${options.programCourseTitles?.length ?? 0} courses
        ${options.lessonCount != null ? ` · ${options.lessonCount} lessons` : ''}
        ${options.durationLabel ? ` · ${escapeHtml(options.durationLabel)}` : ''}
      </p>`
    : '';

  const inviteKindLabel = isProgram ? 'Program invitation' : 'Course invitation';
  const cardKindLabel = isProgram ? 'Program' : 'Course';
  const introLine = isProgram
    ? 'You have been invited to join the program below.'
    : 'You have been invited to join the course below.';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Your Coursify invitation</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f1f5f9;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;">
          <tr>
            <td style="background:linear-gradient(135deg,${COPPER} 0%,${INK} 100%);padding:28px 32px;text-align:center;border-radius:12px 12px 0 0;">
              ${emailBrandMarkHtml()}
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:0.02em;">Coursify</div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#E8D4C8;margin-top:6px;">${inviteKindLabel}</div>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:32px 32px 28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
              <p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#1e293b;">Hi ${passenger},</p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:20px;">
                <tr>
                  <td style="border-left:4px solid ${COPPER};background:#f8fafc;padding:16px 20px;font-size:15px;line-height:1.6;color:#334155;">
                    ${calloutHtml}
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#475569;">${introLine}</p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #e2e8f0;border-top:3px solid ${COPPER};margin-bottom:8px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <div style="font-size:11px;letter-spacing:0.14em;color:${COPPER};font-weight:700;text-transform:uppercase;">${cardKindLabel}</div>
                    <div style="font-size:22px;font-weight:700;color:#0f172a;line-height:1.3;margin-top:10px;">${course}</div>
                    ${programStatsHtml}
                    ${programCoursesHtml}
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:20px;border-top:1px solid #e2e8f0;">
                      <tr>
                        <td style="padding-top:16px;font-size:14px;color:#64748b;">Reserve by</td>
                        <td align="right" style="padding-top:16px;font-size:14px;font-weight:700;color:#0f172a;">${reserveByFormatted}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:32px auto;">
                <tr>
                  <td align="center" style="border-radius:8px;background:linear-gradient(135deg,${COPPER} 0%,${INK} 100%);">
                    <a href="${enrollUrl}" style="display:inline-block;padding:16px 40px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">Accept invitation</a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#1e293b;">Before you begin</p>
              <ul style="margin:0 0 24px;padding-left:20px;font-size:14px;line-height:1.7;color:#475569;">
                <li style="margin-bottom:8px;">Sign in with the Google account for <a href="mailto:${recipientEmail}" style="color:${COPPER};text-decoration:none;font-weight:600;">${recipientEmail}</a></li>
                <li>New to Coursify? Google sign-in creates your account automatically.</li>
              </ul>

              <p style="margin:0 0 8px;font-size:13px;color:#64748b;">Or copy this link:</p>
              <p style="margin:0;font-size:13px;line-height:1.5;word-break:break-all;"><a href="${enrollUrl}" style="color:${COPPER};text-decoration:none;">${enrollUrl}</a></p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:18px 24px;text-align:center;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
              <span style="font-size:12px;line-height:1.5;color:#94a3b8;">${footerLine}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
