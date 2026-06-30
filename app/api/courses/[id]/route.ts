import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase-admin';
import { fetchCourseInviteDetails } from '@/lib/email/fetch-course-invite-details';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const params = await Promise.resolve(context.params);
  const id = params?.id;
  if (!id) return NextResponse.json({ error: 'Course ID required' }, { status: 400 });
  try {
    const db = createServerClient();
    const { data: course, error } = await db
      .from('courses')
      .select('id, title, description, status, created_by')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    if ((course as { status: string }).status !== 'published') {
      return NextResponse.json({ error: 'Course is not published yet' }, { status: 403 });
    }

    let inviterName: string | undefined;
    const createdBy = (course as { created_by?: string | null }).created_by;
    if (createdBy) {
      const { data: profile } = await db
        .from('user_profiles')
        .select('full_name')
        .eq('id', createdBy)
        .maybeSingle();
      inviterName = (profile as { full_name?: string | null } | null)?.full_name?.trim() || undefined;
    }

    const invite = await fetchCourseInviteDetails(id, inviterName);

    return NextResponse.json({
      id: (course as { id: string }).id,
      title: (course as { title: string }).title,
      description: (course as { description: string | null }).description,
      status: (course as { status: string }).status,
      inviterName,
      moduleCount: invite?.moduleCount ?? 0,
      lessonCount: invite?.lessonCount ?? 0,
      durationSeconds: invite?.durationSeconds ?? 0,
      durationLabel: invite?.durationLabel ?? '0m',
      avgRating: invite?.avgRating,
      ratingCount: invite?.ratingCount ?? 0,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Something went wrong';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
