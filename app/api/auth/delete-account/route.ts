import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: Request) {
  if (!url || !anonKey || !serviceKey) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 });
  }
  try {
    const body = await req.json();
    const accessToken = body?.access_token as string | undefined;
    if (!accessToken) {
      return NextResponse.json({ error: 'Missing access_token' }, { status: 400 });
    }
    const anon = createClient(url, anonKey);
    const { data: { user }, error: userError } = await anon.auth.getUser(accessToken);
    if (userError || !user?.id) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }
    const userId = user.id;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { error: deleteError } = await (admin.auth as any).admin.deleteUser(userId);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message || 'Failed to delete account' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}
