/**
 * Server-side Assessment Pro API client. Never import from client components.
 */

function baseUrl(): string {
  return process.env.ASSESSMENT_PRO_BASE_URL?.replace(/\/+$/, '') ?? '';
}

function apiKey(): string {
  return process.env.ASSESSMENT_PRO_API_KEY ?? '';
}

function companySlug(): string {
  return process.env.ASSESSMENT_PRO_COMPANY_SLUG || 'coursify-bsoc-space';
}

export function isAssessmentProConfigured(): boolean {
  return Boolean(baseUrl() && apiKey());
}

export function getAssessmentProGraderUrl(invitationId: string): string | undefined {
  const base = baseUrl();
  if (!base || !invitationId) return undefined;
  return `${base}/${companySlug()}/grade/${invitationId}`;
}

async function apPost<T>(path: string, body: unknown): Promise<T> {
  const url = `${baseUrl()}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(errText || `Assessment Pro API error (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export interface LaunchEmbedParams {
  assessmentId: string;
  learner: { email: string; name: string; externalUserId: string };
  externalRef: {
    enrollmentId: string;
    contentItemId: string;
    courseId: string;
    coursifyUserId?: string;
  };
}

export interface LaunchEmbedResult {
  launchToken: string;
  embedUrl: string;
  sessionId: string;
  expiresAt?: string;
}

export async function launchEmbedAssessment(params: LaunchEmbedParams): Promise<LaunchEmbedResult> {
  const data = await apPost<{
    launchToken?: string;
    embedUrl?: string;
    sessionId?: string;
    expiresAt?: string;
  }>('/api/v1/integrations/lms/launch', {
    assessmentId: params.assessmentId,
    learner: params.learner,
    externalRef: params.externalRef,
  });

  if (!data.launchToken || !data.embedUrl || !data.sessionId) {
    throw new Error('Assessment Pro launch response missing required fields');
  }

  return {
    launchToken: data.launchToken,
    embedUrl: data.embedUrl,
    sessionId: data.sessionId,
    expiresAt: data.expiresAt,
  };
}

export interface ProctoredInvitationParams {
  assessmentId: string;
  email: string;
  candidateName: string;
  externalRef: {
    enrollmentId: string;
    contentItemId: string;
    courseId: string;
    coursifyUserId: string;
  };
}

export interface ProctoredInvitationResult {
  invitation: { id: string; token?: string };
  takeUrl: string;
}

export async function createProctoredInvitation(
  params: ProctoredInvitationParams
): Promise<ProctoredInvitationResult> {
  const data = await apPost<{
    invitation?: { id?: string; token?: string };
    takeUrl?: string;
  }>('/api/v1/integrations/lms/invitations', {
    assessmentId: params.assessmentId,
    email: params.email,
    candidateName: params.candidateName,
    skipEmail: true,
    allowDuplicate: false,
    externalRef: params.externalRef,
  });

  if (!data.invitation?.id || !data.takeUrl) {
    throw new Error('Assessment Pro invitation response missing required fields');
  }

  return {
    invitation: { id: data.invitation.id, token: data.invitation.token },
    takeUrl: data.takeUrl,
  };
}
