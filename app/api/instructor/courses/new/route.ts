/**
 * POST: Create a new course as the authenticated user.
 * Uses server-side session (cookies) and service-role insert so RLS is not blocked
 * when the browser client doesn't send the JWT correctly.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
      },
    },
  });

  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
  if (authError || !user?.id) {
    return NextResponse.json(
      { error: 'Not signed in. Sign in and try again.' },
      { status: 401 }
    );
  }

  let body: { title?: string; description?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : 'Untitled Course';
  const description = typeof body.description === 'string' ? body.description : null;

  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY required to create course' },
      { status: 500 }
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: courseRow, error: insertError } = await supabaseAdmin
    .from('courses')
    .insert({
      title,
      description,
      status: 'draft',
      created_by: user.id,
    })
    .select('id')
    .single();

  if (insertError) {
    return NextResponse.json(
      { error: insertError.message, details: insertError.details },
      { status: 500 }
    );
  }

  const courseId = (courseRow as { id: string } | null)?.id;
  if (!courseId) {
    return NextResponse.json({ error: 'Course created but no id returned' }, { status: 500 });
  }

  return NextResponse.json({ id: courseId });
}
