import { NextRequest, NextResponse } from 'next/server';
import { requireInstructor } from '@/lib/instructor-auth';
import { createServerClient } from '@/lib/supabase-admin';
import {
  assertCoursesAssignable,
  listCoursePrograms,
  replaceProgramMembers,
} from '@/lib/course-programs';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await requireInstructor(request);
  if ('error' in auth) return auth.error;

  try {
    const db = createServerClient();
    const programs = await listCoursePrograms(db, auth.user.id);
    return NextResponse.json({ programs });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load programs';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireInstructor(request);
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const description =
      typeof body.description === 'string' && body.description.trim()
        ? body.description.trim()
        : null;
    const courseIds = Array.isArray(body.courseIds)
      ? body.courseIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
      : [];

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const db = createServerClient();
    await assertCoursesAssignable(db, auth.user.id, courseIds);

    const uniqueCourseIds: string[] = Array.from(new Set(courseIds));
    const { data: program, error } = await db
      .from('course_programs')
      .insert({
        title,
        description,
        created_by: auth.user.id,
      })
      .select('id')
      .single();

    if (error || !program) {
      return NextResponse.json({ error: error?.message ?? 'Failed to create program' }, { status: 500 });
    }

    const programId = (program as { id: string }).id;
    await replaceProgramMembers(db, programId, uniqueCourseIds);

    const programs = await listCoursePrograms(db, auth.user.id);
    const created = programs.find((p) => p.id === programId);
    return NextResponse.json({ program: created ?? { id: programId, title } }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create program';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
