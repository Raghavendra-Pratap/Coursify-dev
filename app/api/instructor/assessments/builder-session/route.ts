import { NextResponse } from 'next/server';
import { requireInstructor } from '@/lib/instructor-auth';
import { createBuilderSession, isAssessmentProConfigured } from '@/lib/assessment-pro';

export async function POST(request: Request) {
  const auth = await requireInstructor(request);
  if ('error' in auth) return auth.error;

  if (!isAssessmentProConfigured()) {
    return NextResponse.json(
      { error: 'Assessment Pro is not configured. Set ASSESSMENT_PRO_BASE_URL and ASSESSMENT_PRO_API_KEY.' },
      { status: 503 }
    );
  }

  let body: { accessMode?: string; assessmentId?: string; title?: string; parentOrigin?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const accessMode = body.accessMode === 'proctored_portal' ? 'proctored_portal' : 'lms_embed';

  try {
    const session = await createBuilderSession({
      accessMode,
      assessmentId: body.assessmentId?.trim() || undefined,
      title: body.title?.trim() || undefined,
      parentOrigin: body.parentOrigin?.trim() || undefined,
    });
    return NextResponse.json(session);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to start builder session';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
