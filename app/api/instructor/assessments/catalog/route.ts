import { NextResponse } from 'next/server';
import { requireInstructor } from '@/lib/instructor-auth';
import { isAssessmentProConfigured, listAssessments } from '@/lib/assessment-pro';

export async function GET(request: Request) {
  const auth = await requireInstructor(request);
  if ('error' in auth) return auth.error;

  if (!isAssessmentProConfigured()) {
    return NextResponse.json(
      { error: 'Assessment Pro is not configured. Set ASSESSMENT_PRO_BASE_URL and ASSESSMENT_PRO_API_KEY.' },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const accessMode = searchParams.get('accessMode') ?? undefined;

  try {
    const assessments = await listAssessments(accessMode ?? undefined);
    return NextResponse.json({ assessments });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to load assessments';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
