import { createServerClient } from '@supabase/ssr';
import { createServerClient as createServiceClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function createAuthClient(request: Request) {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.headers.get('cookie')?.split(';').find((c) => c.trim().startsWith(name + '='))?.split('=')[1] ?? undefined;
      },
      set() {},
      remove() {},
    },
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const supabaseAuth = createAuthClient(request);
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = createServiceClient();
  const { data: canPublish } = await db.rpc('is_course_owner_or_collaborator', { cid: courseId });
  if (!canPublish) return NextResponse.json({ error: 'Only course owner or collaborator can notify' }, { status: 403 });
  const { data: course } = await db.from('courses').select('title').eq('id', courseId).single();
  const title = course?.title ?? 'Course';
  const { data: enrollments } = await db.from('enrollments').select('user_id').eq('course_id', courseId);
  if (!enrollments?.length) return NextResponse.json({ notified: 0 });
  const inserts = enrollments.map((e: { user_id: string }) => ({
    user_id: e.user_id,
    type: 'course_update',
    title: 'Course updated',
    body: `${title} was republished. Check the updated or new modules.`,
    link: `/`,
    related_id: courseId,
  }));
  const { error } = await db.from('user_notifications').insert(inserts);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notified: inserts.length });
}
