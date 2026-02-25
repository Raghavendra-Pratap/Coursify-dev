import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anonKey || !serviceKey) {
      return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 });
    }

    const anon = createClient(url, anonKey);
    const { data: { session } } = await anon.auth.getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const courseId = body?.courseId;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : null;
    if (!courseId || !email) {
      return NextResponse.json({ error: 'courseId and email required' }, { status: 400 });
    }

    const { data: course } = await anon.from('courses').select('id, created_by').eq('id', courseId).maybeSingle();
    if (!course || (course as { created_by: string }).created_by !== session.user.id) {
      return NextResponse.json({ error: 'Course not found or you are not the owner' }, { status: 403 });
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: { users } } = await admin.auth.admin.listUsers({ page: 1, perPage: 50 });
    const invitee = users?.find((u) => u.email?.toLowerCase() === email) ?? null;
    if (!invitee?.id) {
      return NextResponse.json({ error: 'No account found with this email' }, { status: 404 });
    }

    if (invitee.id === session.user.id) {
      return NextResponse.json({ error: 'You cannot add yourself as a collaborator' }, { status: 400 });
    }

    const { error: insertError } = await admin.from('course_collaborators').insert({
      course_id: courseId,
      user_id: invitee.id,
      invited_by: session.user.id,
    });
    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'This user is already a collaborator' }, { status: 409 });
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('invite-collaborator', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
