import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-admin';
import { fetchProgramInviteDetails } from '@/lib/email/fetch-program-invite-details';

export async function GET(
  _request: NextRequest,
  { params }: { params: { programId: string } },
) {
  const programId = params?.programId;
  if (!programId) return NextResponse.json({ error: 'Program ID required' }, { status: 400 });

  try {
    const db = createServerClient();
    const { data: program } = await db
      .from('course_programs')
      .select('id, title, description, created_by')
      .eq('id', programId)
      .maybeSingle();
    if (!program) return NextResponse.json({ error: 'Program not found' }, { status: 404 });

    const ownerId = (program as { created_by: string }).created_by;
    let inviterName: string | undefined;
    const { data: profile } = await db.from('user_profiles').select('full_name').eq('id', ownerId).maybeSingle();
    inviterName = (profile as { full_name?: string | null } | null)?.full_name?.trim() || undefined;

    const details = await fetchProgramInviteDetails(programId, inviterName);
    if (!details || details.courseCount === 0) {
      return NextResponse.json({ error: 'Program has no courses' }, { status: 404 });
    }

    const { data: members } = await db
      .from('course_program_members')
      .select('course_id, order_index, courses(id, title, status)')
      .eq('program_id', programId)
      .order('order_index');

    const courses = (members ?? [])
      .map((m) => {
        const c = (m as { courses?: { id: string; title: string; status: string } | { id: string; title: string; status: string }[] | null }).courses;
        const course = Array.isArray(c) ? c[0] : c;
        return course?.status === 'published' ? { id: course.id, title: course.title } : null;
      })
      .filter((c): c is { id: string; title: string } => c !== null);

    if (courses.length === 0) {
      return NextResponse.json({ error: 'Program has no published courses' }, { status: 404 });
    }

    return NextResponse.json({
      id: programId,
      title: details.programTitle,
      description: details.description,
      inviterName: details.inviterName,
      courses,
      courseCount: courses.length,
      moduleCount: details.moduleCount,
      lessonCount: details.lessonCount,
      durationLabel: details.durationLabel,
    });
  } catch {
    return NextResponse.json({ error: 'Could not load program' }, { status: 500 });
  }
}
