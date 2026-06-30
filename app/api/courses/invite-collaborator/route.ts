import { NextResponse } from 'next/server';
import { buildCollaboratorInviteEmail, isResendConfigured, sendEmail } from '@/lib/resend-email';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

function createAuthClient(request: Request, url: string, anonKey: string) {
  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return request.headers.get('cookie')?.split(';').find((c) => c.trim().startsWith(name + '='))?.split('=')[1] ?? undefined;
      },
      set() {},
      remove() {},
    },
  });
}

export async function POST(req: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anonKey || !serviceKey) {
      return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 });
    }

    const supabaseAuth = createAuthClient(req, url, anonKey);
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const courseId = body?.courseId;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : null;
    if (!courseId || !email) {
      return NextResponse.json({ error: 'courseId and email required' }, { status: 400 });
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    const { data: course } = await admin.from('courses').select('id, created_by, title').eq('id', courseId).maybeSingle();
    if (!course || (course as { created_by: string }).created_by !== user.id) {
      return NextResponse.json({ error: 'Course not found or you are not the owner' }, { status: 403 });
    }

    // Search all pages because listUsers is paginated.
    let invitee: { id: string; email?: string | null } | null = null;
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const users = data?.users ?? [];
      invitee = users.find((u) => u.email?.toLowerCase() === email) ?? null;
      if (invitee || users.length < 200) break;
    }

    if (!invitee?.id) {
      return NextResponse.json({ error: 'No account found with this email' }, { status: 404 });
    }

    if (invitee.id === user.id) {
      return NextResponse.json({ error: 'You cannot add yourself as a collaborator' }, { status: 400 });
    }

    const { error: insertError } = await admin.from('course_collaborators').insert({
      course_id: courseId,
      user_id: invitee.id,
      invited_by: user.id,
    });
    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'This user is already a collaborator' }, { status: 409 });
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    let emailSent = false;
    if (isResendConfigured() && invitee.email) {
      try {
        const { data: profile } = await admin.from('user_profiles').select('full_name').eq('id', user.id).maybeSingle();
        const inviterName = (profile as { full_name?: string | null } | null)?.full_name?.trim() || user.email?.split('@')[0];
        const courseTitle = (course as { title?: string }).title || 'your course';
        const { subject, text } = buildCollaboratorInviteEmail({
          courseTitle,
          courseId: String(courseId),
          inviterName,
        });
        await sendEmail({ to: invitee.email, subject, text });
        emailSent = true;
      } catch {
        // collaborator added; email is best-effort
      }
    }

    return NextResponse.json({ ok: true, emailSent });
  } catch (e) {
    console.error('invite-collaborator', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
