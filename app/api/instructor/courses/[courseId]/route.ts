import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { createServerClient as createServiceClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function fetchCourseForInstructor(courseId: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error('Server misconfiguration');

  const res = await fetch(
    `${base}/rest/v1/courses?id=eq.${encodeURIComponent(courseId)}&select=id,title,description,status,has_unpublished_changes,published_at,updated_at,created_by`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `Supabase REST error (${res.status})`);
  }
  const rows = (await res.json()) as Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    has_unpublished_changes?: boolean | null;
    published_at?: string | null;
    updated_at?: string;
    created_by?: string;
  }>;
  return rows[0] ?? null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> | { courseId: string } }
) {
  const { courseId } = await Promise.resolve(params);
  if (!courseId) return NextResponse.json({ error: 'Course ID required' }, { status: 400 });

  const cookieHeader = request.headers.get('cookie') ?? '';
  const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
        return match ? decodeURIComponent(match[1]) : undefined;
      },
      set() {},
      remove() {},
    },
  });

  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const course = await fetchCourseForInstructor(courseId);
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

    let allowed = course.created_by === user.id;
    if (!allowed) {
      const db = createServiceClient();
      const { data: collab } = await db
        .from('course_collaborators')
        .select('id')
        .eq('course_id', courseId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (collab) allowed = true;
      if (!allowed) {
        const { data: profile } = await db.from('user_profiles').select('role').eq('id', user.id).maybeSingle();
        allowed = (profile as { role?: string } | null)?.role === 'admin';
      }
    }
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    return NextResponse.json({
      id: course.id,
      title: course.title,
      description: course.description,
      status: course.status,
      hasUnpublishedChanges: !!course.has_unpublished_changes,
      publishedAt: course.published_at ?? null,
      updatedAt: course.updated_at,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not load course';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
