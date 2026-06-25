import { NextResponse } from 'next/server';
import { requireInstructor } from '@/lib/instructor-auth';
import { createAssessment, isAssessmentProConfigured } from '@/lib/assessment-pro';

export async function POST(request: Request) {
  const auth = await requireInstructor(request);
  if ('error' in auth) return auth.error;

  if (!isAssessmentProConfigured()) {
    return NextResponse.json(
      { error: 'Assessment Pro is not configured. Set ASSESSMENT_PRO_BASE_URL and ASSESSMENT_PRO_API_KEY.' },
      { status: 503 }
    );
  }

  let body: {
    title?: string;
    description?: string;
    accessMode?: string;
    passingScore?: number;
    durationMinutes?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const accessMode = body.accessMode === 'proctored_portal' ? 'proctored_portal' : 'lms_embed';
  const passingScore =
    typeof body.passingScore === 'number' && Number.isFinite(body.passingScore)
      ? Math.min(100, Math.max(0, Math.round(body.passingScore)))
      : 70;

  try {
    const assessment = await createAssessment({
      title,
      description: body.description?.trim(),
      accessMode,
      passingScore,
      durationMinutes:
        typeof body.durationMinutes === 'number' && Number.isFinite(body.durationMinutes)
          ? body.durationMinutes
          : undefined,
    });
    return NextResponse.json({ assessment });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to create assessment';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
