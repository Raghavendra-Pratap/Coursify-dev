/** Invitation card HTML for learner invite emails (table layout for email clients). */

const COPPER = '#C67B4E';
const COPPER_LIGHT = '#E8A87C';
const INK = '#0B1018';
const CARD = '#121A24';
const CARD_STUB = '#0E1520';
const MUTED = '#7A8FA3';
const WHITE = '#F4F7FA';
const EMAIL_WIDTH = 780;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function titleCaseFromEmail(email: string): string {
  const local = email.split('@')[0] ?? 'Learner';
  return local
    .replace(/[._+-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .slice(0, 48) || 'Learner';
}

function courseCode(courseTitle?: string, courseId?: string): string {
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

function enrollmentCode(recipientEmail: string, courseId?: string): string {
  const local = recipientEmail.split('@')[0] ?? 'XX';
  const initials = local.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase() || 'XX';
  const suffix = courseId
    ? courseId.replace(/-/g, '').slice(-4).toUpperCase()
    : local.replace(/\D/g, '').slice(-4).padStart(4, '0') || '0000';
  return `${initials}-${suffix}`;
}

function instructorInitials(name?: string): string {
  if (!name?.trim()) return '—';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}.${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatBoardingDate(date: Date): string {
  return date
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase()
    .replace(/ /g, ' ');
}

function reserveByDate(days = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatBoardingDate(d);
}

function destinationLabel(courseTitle?: string): string {
  if (!courseTitle) return 'COURSIFY';
  const words = courseTitle.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'LEARNING';
  if (words.length === 1) return words[0].toUpperCase().slice(0, 12);
  return `${words[0]} ${words[words.length - 1]}`.toUpperCase().slice(0, 16);
}

function barcodeCells(): string {
  const widths = [2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 1, 2, 3, 1, 2, 1, 3, 2, 4, 1, 2, 1, 3, 2, 1, 4, 2, 1, 3, 2, 1, 4, 2, 1, 3, 2, 4];
  return widths
    .map(
      (w) =>
        `<td style="width:${w}px;background:${COPPER};font-size:0;line-height:0;padding:0;height:28px;">&nbsp;</td>`,
    )
    .join('');
}

function gridCell(label: string, value: string): string {
  return `
    <td style="vertical-align:top;padding:0 16px 0 0;border-right:1px solid #243040;">
      <div style="font-size:9px;letter-spacing:0.12em;color:${MUTED};margin-bottom:4px;">${escapeHtml(label)}</div>
      <div style="font-size:13px;font-weight:700;color:${WHITE};letter-spacing:0.04em;">${escapeHtml(value)}</div>
    </td>`;
}

export type BoardingPassInviteOptions = {
  recipientEmail: string;
  recipientName?: string;
  courseTitle?: string;
  courseId?: string;
  inviterName?: string;
  enrollUrl: string;
  reserveDays?: number;
};

export function buildBoardingPassInviteHtml(options: BoardingPassInviteOptions): string {
  const {
    recipientEmail,
    recipientName,
    courseTitle,
    courseId,
    inviterName,
    enrollUrl,
    reserveDays = 30,
  } = options;

  const passenger = escapeHtml(recipientName?.trim() || titleCaseFromEmail(recipientEmail));
  const course = escapeHtml(courseTitle?.trim() || 'Coursify Learning');
  const code = courseCode(courseTitle, courseId);
  const enrollCode = enrollmentCode(recipientEmail, courseId);
  const instructor = escapeHtml(instructorInitials(inviterName));
  const cohortLabel = new Date().getFullYear().toString();
  const begins = formatBoardingDate(new Date());
  const destination = escapeHtml(destinationLabel(courseTitle));
  const reserveBy = reserveByDate(reserveDays);
  const seat = enrollCode.split('-')[1]?.slice(0, 2) ?? '01';
  const host = enrollUrl.replace(/^https?:\/\//, '').split('/')[0];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Your Coursify invitation</title>
</head>
<body style="margin:0;padding:32px 16px;background:${INK};font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:${EMAIL_WIDTH}px;margin:0 auto;">
    <tr>
      <td align="center" style="padding-bottom:20px;">
        <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.2em;color:${MUTED};text-transform:uppercase;">Coursify · Invitation</span>
      </td>
    </tr>
    <tr>
      <td>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${EMAIL_WIDTH}" style="width:100%;max-width:${EMAIL_WIDTH}px;background:${CARD};border-radius:20px;border:1px solid #243040;overflow:hidden;">
          <tr>
            <!-- Main invitation -->
            <td width="74%" style="vertical-align:top;padding:32px 28px 28px 32px;background:${CARD};">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:0.18em;color:${COPPER};text-transform:uppercase;margin-bottom:14px;">Invitation · Coursify</div>
              <div style="font-size:28px;line-height:1.15;color:${COPPER};font-weight:400;margin-bottom:6px;">${passenger}</div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${MUTED};margin-bottom:10px;">you&rsquo;re invited to join</div>
              <div style="font-size:22px;line-height:1.25;color:${COPPER_LIGHT};font-style:italic;margin-bottom:24px;">${course}</div>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:22px;">
                <tr>
                  <td width="42%" style="vertical-align:top;">
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.12em;color:${MUTED};margin-bottom:4px;">COHORT BEGINS</div>
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;color:${WHITE};">${begins}</div>
                  </td>
                  <td width="16%" align="center" style="vertical-align:middle;">
                    <div style="width:36px;height:36px;border-radius:50%;border:1px solid ${COPPER};text-align:center;line-height:36px;color:${COPPER};font-family:Arial,Helvetica,sans-serif;font-size:16px;">→</div>
                  </td>
                  <td width="42%" style="vertical-align:top;text-align:right;">
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.12em;color:${MUTED};margin-bottom:4px;">DESTINATION</div>
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;color:${WHITE};">${destination}</div>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:22px;font-family:Arial,Helvetica,sans-serif;">
                <tr>
                  ${gridCell('COHORT', cohortLabel)}
                  ${gridCell('COURSE', code)}
                  ${gridCell('SEAT', `${seat}A`)}
                  <td style="vertical-align:top;padding:0;">
                    <div style="font-size:9px;letter-spacing:0.12em;color:${MUTED};margin-bottom:4px;">INSTRUCTOR</div>
                    <div style="font-size:13px;font-weight:700;color:${WHITE};">${instructor}</div>
                  </td>
                </tr>
              </table>

              <div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.1em;color:${MUTED};line-height:1.6;margin-bottom:14px;">
                SEATS ARE LIMITED · RESERVE BY ${reserveBy} AT ${escapeHtml(host.toUpperCase())}
              </div>

              <table role="presentation" cellpadding="0" cellspacing="2" border="0"><tr>${barcodeCells()}</tr></table>
            </td>

            <!-- Stub -->
            <td width="26%" style="vertical-align:top;padding:28px 24px;background:${CARD_STUB};border-left:2px dashed #3A4A5C;">
              <div style="width:28px;height:28px;border-radius:50%;border:1px solid ${COPPER};text-align:center;line-height:28px;color:${COPPER};font-family:Arial,Helvetica,sans-serif;font-size:14px;margin-bottom:18px;">↗</div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.12em;color:${MUTED};margin-bottom:4px;">COURSE CODE</div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;color:${WHITE};margin-bottom:28px;">${escapeHtml(code)}</div>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 20px;">
                <tr>
                  <td align="center" style="border-radius:50%;background:${COPPER};width:52px;height:52px;text-align:center;">
                    <a href="${escapeHtml(enrollUrl)}" style="display:block;width:52px;height:52px;line-height:52px;color:${INK};text-decoration:none;font-size:22px;font-weight:700;">→</a>
                  </td>
                </tr>
              </table>

              <div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.12em;color:${MUTED};margin-bottom:4px;">ENROLLMENT CODE</div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:${COPPER_LIGHT};letter-spacing:0.08em;">${escapeHtml(enrollCode)}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:24px 8px 0;font-family:Arial,Helvetica,sans-serif;">
        <a href="${escapeHtml(enrollUrl)}" style="display:inline-block;padding:14px 28px;background:${COPPER};color:${INK};text-decoration:none;border-radius:999px;font-size:14px;font-weight:700;letter-spacing:0.04em;">Accept invitation →</a>
        <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:${MUTED};">
          Sign in with Google using <strong style="color:${WHITE};">${escapeHtml(recipientEmail)}</strong> to join this course.
        </p>
        <p style="margin:12px 0 0;font-size:11px;line-height:1.5;color:#5A6A7A;word-break:break-all;">
          <a href="${escapeHtml(enrollUrl)}" style="color:${COPPER_LIGHT};">${escapeHtml(enrollUrl)}</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildBoardingPassInviteSubject(courseTitle?: string, inviterName?: string): string {
  const course = courseTitle?.trim();
  const inviter = inviterName?.trim();
  if (inviter && course) return `${inviter} invited you to ${course}`;
  if (course) return `Invitation to ${course} on Coursify`;
  return 'Your invitation to Coursify';
}

/** Plain-text body for multipart emails (improves deliverability vs HTML-only). */
export function buildBoardingPassInviteText(options: BoardingPassInviteOptions): string {
  const passenger = options.recipientName?.trim() || titleCaseFromEmail(options.recipientEmail);
  const course = options.courseTitle?.trim() || 'a Coursify course';
  const inviter = options.inviterName?.trim();
  const siteHost = options.enrollUrl.replace(/^https?:\/\//, '').split('/')[0];

  const lines = [
    `Hi ${passenger},`,
    '',
    inviter
      ? `${inviter} invited you to join "${course}" on Coursify.`
      : `You have been invited to join "${course}" on Coursify.`,
    '',
    'To accept, sign in with Google using this email address:',
    options.recipientEmail,
    '',
    'Enrollment link:',
    options.enrollUrl,
    '',
    'If the link does not open, copy and paste it into your browser.',
    '',
    'If you did not expect this invitation, you can safely ignore this email.',
    '',
    '— Coursify',
    siteHost,
  ];
  return lines.join('\n');
}
