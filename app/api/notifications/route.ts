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

export async function GET(request: Request) {
  const supabaseAuth = createAuthClient(request);
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = createServiceClient();
  const { data: rows, error } = await db
    .from('user_notifications')
    .select('id, type, title, body, link, related_id, read_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const unreadCount = (rows ?? []).filter((r: { read_at: string | null }) => !r.read_at).length;
  return NextResponse.json({ notifications: rows ?? [], unreadCount }, { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=60' } });
}

export async function PATCH(request: Request) {
  const supabaseAuth = createAuthClient(request);
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const markAll = body.mark_all === true;
  const id = typeof body.id === 'string' ? body.id : null;
  const db = createServiceClient();
  if (markAll) {
    const { error } = await db.from('user_notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=60' } });
  }
  if (id) {
    const { error } = await db.from('user_notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=60' } });
  }
  return NextResponse.json({ error: 'Provide id or mark_all' }, { status: 400 });
}
