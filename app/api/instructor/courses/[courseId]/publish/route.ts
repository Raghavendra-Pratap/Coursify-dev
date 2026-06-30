import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { createServerClient as createServiceClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function canPublishCourse(db: ReturnType<typeof createServiceClient>, courseId: string, userId: string) {
  const { data: course, error } = await db
    .from('courses')
    .select('id, created_by, status')
    .eq('id', courseId)
    .maybeSingle();
  if (error || !course) return { allowed: false as const, reason: 'Course not found' };

  if ((course as { created_by: string }).created_by === userId) {
    return { allowed: true as const };
  }

  const { data: profile } = await db.from('user_profiles').select('role').eq('id', userId).maybeSingle();
  if ((profile as { role?: string } | null)?.role === 'admin') {
    return { allowed: true as const };
  }

  return { allowed: false as const, reason: 'Only the course owner or an admin can publish' };
}

async function publishCourseViaRest(courseId: string): Promise<{ id: string; status: string }> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error('Server misconfiguration');

  const now = new Date().toISOString();
  const payloads = [
    { status: 'published', published_at: now, has_unpublished_changes: false, updated_at: now },
    { status: 'published', updated_at: now },
  ];

  for (const body of payloads) {
    const res = await fetch(`${base}/rest/v1/courses?id=eq.${encodeURIComponent(courseId)}`, {
      method: 'PATCH',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      if (body.has_unpublished_changes === false && /has_unpublished_changes|published_at/i.test(errText)) {
        continue;
      }
      throw new Error(errText || `Publish failed (${res.status})`);
    }
    const rows = (await res.json()) as Array<{ id: string; status: string }>;
    const row = rows[0];
    if (row?.status === 'published') return row;
  }

  throw new Error('Publish did not update course status');
}

export async function POST(
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

  let db: ReturnType<typeof createServiceClient>;
  try {
    db = createServiceClient();
  } catch {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 503 });
  }

  const access = await canPublishCourse(db, courseId, user.id);
  if (!access.allowed) {
    return NextResponse.json({ error: access.reason }, { status: access.reason === 'Course not found' ? 404 : 403 });
  }

  try {
    const updated = await publishCourseViaRest(courseId);
    return NextResponse.json({ ok: true, course: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to publish course';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
