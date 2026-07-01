import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createServiceClient } from '@/lib/supabase-admin';

export async function POST(
  request: NextRequest,
  { params }: { params: { programId: string } },
) {
  const programId = params?.programId;
  if (!programId) return NextResponse.json({ error: 'Program ID required' }, { status: 400 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set() {},
      remove() {},
    },
  });

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  let admin: ReturnType<typeof createServiceClient>;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ error: 'Server config' }, { status: 503 });
  }

  const { data: members } = await admin
    .from('course_program_members')
    .select('course_id, courses(status)')
    .eq('program_id', programId);

  const courseIds = (members ?? [])
    .filter((m) => {
      const c = (m as { courses?: { status?: string } | { status?: string }[] | null }).courses;
      const course = Array.isArray(c) ? c[0] : c;
      return course?.status === 'published';
    })
    .map((m) => (m as { course_id: string }).course_id);

  if (courseIds.length === 0) {
    return NextResponse.json({ error: 'Program has no enrollable courses' }, { status: 404 });
  }

  const userId = session.user.id;
  const { data: existing } = await admin
    .from('enrollments')
    .select('course_id')
    .eq('user_id', userId)
    .in('course_id', courseIds);

  const enrolled = new Set((existing ?? []).map((e: { course_id: string }) => e.course_id));
  let added = 0;
  for (const courseId of courseIds) {
    if (enrolled.has(courseId)) continue;
    const { error } = await admin.from('enrollments').insert({ course_id: courseId, user_id: userId });
    if (!error) {
      added++;
      enrolled.add(courseId);
    }
  }

  return NextResponse.json({ ok: true, enrolled: added, totalCourses: courseIds.length });
}
