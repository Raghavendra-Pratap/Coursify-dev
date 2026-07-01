import { NextRequest, NextResponse } from 'next/server';
import { requireInstructor } from '@/lib/instructor-auth';
import { createServerClient } from '@/lib/supabase-admin';
import {
  assertCoursesAssignable,
  listCoursePrograms,
  replaceProgramMembers,
} from '@/lib/course-programs';

export const runtime = 'nodejs';

type RouteContext = { params: { programId: string } };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = await requireInstructor(request);
  if ('error' in auth) return auth.error;

  const programId = params.programId;
  if (!programId) {
    return NextResponse.json({ error: 'programId required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const db = createServerClient();

    const { data: existing, error: findErr } = await db
      .from('course_programs')
      .select('id, created_by')
      .eq('id', programId)
      .maybeSingle();

    if (findErr) {
      return NextResponse.json({ error: findErr.message }, { status: 500 });
    }
    if (!existing || (existing as { created_by: string }).created_by !== auth.user.id) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const patch: Record<string, string | null> = {};
    if (typeof body.title === 'string') {
      const title = body.title.trim();
      if (!title) return NextResponse.json({ error: 'title cannot be empty' }, { status: 400 });
      patch.title = title;
    }
    if (body.description !== undefined) {
      patch.description =
        typeof body.description === 'string' && body.description.trim()
          ? body.description.trim()
          : null;
    }

    if (Object.keys(patch).length > 0) {
      const { error: updErr } = await db.from('course_programs').update(patch).eq('id', programId);
      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }
    }

    if (Array.isArray(body.courseIds)) {
      const courseIds = body.courseIds.filter(
        (id: unknown): id is string => typeof id === 'string' && id.length > 0,
      );
      await assertCoursesAssignable(db, auth.user.id, courseIds);
      await replaceProgramMembers(db, programId, Array.from(new Set(courseIds)));
    }

    const programs = await listCoursePrograms(db, auth.user.id);
    const program = programs.find((p) => p.id === programId);
    return NextResponse.json({ program });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update program';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const auth = await requireInstructor(_request);
  if ('error' in auth) return auth.error;

  const programId = params.programId;
  if (!programId) {
    return NextResponse.json({ error: 'programId required' }, { status: 400 });
  }

  try {
    const db = createServerClient();
    const { data: existing, error: findErr } = await db
      .from('course_programs')
      .select('id, created_by')
      .eq('id', programId)
      .maybeSingle();

    if (findErr) {
      return NextResponse.json({ error: findErr.message }, { status: 500 });
    }
    if (!existing || (existing as { created_by: string }).created_by !== auth.user.id) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const { error } = await db.from('course_programs').delete().eq('id', programId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to delete program';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
