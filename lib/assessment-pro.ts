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

async function apGet<T>(path: string): Promise<T> {
  const url = `${baseUrl()}${path}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
    },
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(errText || `Assessment Pro API error (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export interface ApAssessmentSummary {
  id: string;
  title: string;
  description?: string;
  accessMode: 'lms_embed' | 'proctored_portal';
  passingScore: number;
  durationMinutes?: number;
  questionCount?: number;
  isDraft?: boolean;
  isPublished?: boolean;
}

export async function listAssessments(accessMode?: string): Promise<ApAssessmentSummary[]> {
  const qs = accessMode ? `?accessMode=${encodeURIComponent(accessMode)}` : '';
  const data = await apGet<{ assessments?: ApAssessmentSummary[] }>(
    `/api/v1/integrations/lms/assessments${qs}`
  );
  return data.assessments ?? [];
}

export interface CreateAssessmentParams {
  title: string;
  description?: string;
  accessMode: 'lms_embed' | 'proctored_portal';
  passingScore?: number;
  durationMinutes?: number;
}

export async function createAssessment(params: CreateAssessmentParams): Promise<ApAssessmentSummary> {
  const data = await apPost<{ assessment?: ApAssessmentSummary }>(
    '/api/v1/integrations/lms/assessments',
    {
      title: params.title,
      description: params.description ?? '',
      accessMode: params.accessMode,
      passingScore: params.passingScore ?? 70,
      durationMinutes: params.durationMinutes,
    }
  );
  if (!data.assessment?.id) {
    throw new Error('Assessment Pro create response missing assessment id');
  }
  return data.assessment;
}

export interface BuilderSessionParams {
  accessMode: 'lms_embed' | 'proctored_portal';
  assessmentId?: string;
  title?: string;
  parentOrigin?: string;
}

export interface BuilderSessionResult {
  embedBuilderUrl: string;
  assessmentId?: string;
  builderToken?: string;
  expiresAt?: string;
}

export async function createBuilderSession(params: BuilderSessionParams): Promise<BuilderSessionResult> {
  const data = await apPost<{
    embedBuilderUrl?: string;
    assessmentId?: string;
    builderToken?: string;
    expiresAt?: string;
  }>('/api/v1/integrations/lms/builder-sessions', {
    accessMode: params.accessMode,
    assessmentId: params.assessmentId,
    title: params.title,
    parentOrigin: params.parentOrigin,
  });
  if (!data.embedBuilderUrl) {
    throw new Error('Assessment Pro builder response missing embedBuilderUrl');
  }
  return {
    embedBuilderUrl: data.embedBuilderUrl,
    assessmentId: data.assessmentId,
    builderToken: data.builderToken,
    expiresAt: data.expiresAt,
  };
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
  parentOrigin?: string;
}

export interface LaunchEmbedResult {
  launchToken: string;
  embedUrl: string;
  sessionId: string;
  expiresAt?: string;
}

/** HEAD probe: AP currently returns X-Frame-Options: SAMEORIGIN + login redirect when framing is not configured. */
export async function probeEmbedFraming(embedUrl: string): Promise<{ iframeAllowed: boolean }> {
  try {
    const res = await fetch(embedUrl, { method: 'HEAD', redirect: 'manual' });
    const xfo = res.headers.get('x-frame-options')?.toUpperCase();
    const location = res.headers.get('location') ?? '';
    if (res.status >= 300 && res.status < 400 && /login/i.test(location)) {
      return { iframeAllowed: false };
    }
    if (xfo === 'SAMEORIGIN' || xfo === 'DENY') {
      return { iframeAllowed: false };
    }
    return { iframeAllowed: res.ok || res.status < 400 };
  } catch {
    return { iframeAllowed: false };
  }
}

export async function launchEmbedAssessment(params: LaunchEmbedParams): Promise<LaunchEmbedResult> {
  const data = await apPost<{
    launchToken?: string;
    embedUrl?: string;
    sessionId?: string | null;
    invitationId?: string;
    expiresAt?: string;
  }>('/api/v1/integrations/lms/launch', {
    assessmentId: params.assessmentId,
    learner: params.learner,
    externalRef: params.externalRef,
    parentOrigin: params.parentOrigin,
  });

  const sessionId = data.sessionId ?? data.invitationId;
  if (!data.launchToken || !data.embedUrl || !sessionId) {
    throw new Error('Assessment Pro launch response missing required fields');
  }

  return {
    launchToken: data.launchToken,
    embedUrl: data.embedUrl,
    sessionId,
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
