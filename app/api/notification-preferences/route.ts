import { createServerClient } from '@supabase/ssr';
import { createServerClient as createServiceClient } from '@/lib/supabase';
import { DEFAULT_NOTIFICATION_PREFERENCES, createDefaultPreferences, type NotificationPreferencesRow } from '@/lib/notification-preferences';
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

  try {
    const db = createServiceClient() as any;
    const { data, error } = await db
      .from('user_notification_preferences')
      .select('user_id, notify_course_updates, notify_question_answers, notify_new_questions, notify_enrollments, updated_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ preferences: createDefaultPreferences(user.id), storageReady: !error }, { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=60' } });
    }

    const preferences: NotificationPreferencesRow = {
      user_id: user.id,
      notify_course_updates: data.notify_course_updates ?? true,
      notify_question_answers: data.notify_question_answers ?? true,
      notify_new_questions: data.notify_new_questions ?? true,
      notify_enrollments: data.notify_enrollments ?? true,
      updated_at: data.updated_at,
    };
    return NextResponse.json({ preferences, storageReady: true }, { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=60' } });
  } catch {
    return NextResponse.json({ preferences: createDefaultPreferences(user.id), storageReady: false }, { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=60' } });
  }
}

export async function PATCH(request: Request) {
  const supabaseAuth = createAuthClient(request);
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const patch = body && typeof body === 'object' ? body as Record<string, unknown> : {};

  const next = {
    notify_course_updates: typeof patch.notify_course_updates === 'boolean' ? patch.notify_course_updates : DEFAULT_NOTIFICATION_PREFERENCES.notify_course_updates,
    notify_question_answers: typeof patch.notify_question_answers === 'boolean' ? patch.notify_question_answers : DEFAULT_NOTIFICATION_PREFERENCES.notify_question_answers,
    notify_new_questions: typeof patch.notify_new_questions === 'boolean' ? patch.notify_new_questions : DEFAULT_NOTIFICATION_PREFERENCES.notify_new_questions,
    notify_enrollments: typeof patch.notify_enrollments === 'boolean' ? patch.notify_enrollments : DEFAULT_NOTIFICATION_PREFERENCES.notify_enrollments,
  };

  try {
    const db = createServiceClient() as any;
    const { data: existing } = await db
      .from('user_notification_preferences')
      .select('user_id, notify_course_updates, notify_question_answers, notify_new_questions, notify_enrollments')
      .eq('user_id', user.id)
      .maybeSingle();

    const merged = {
      user_id: user.id,
      notify_course_updates: typeof patch.notify_course_updates === 'boolean' ? patch.notify_course_updates : (existing?.notify_course_updates ?? next.notify_course_updates),
      notify_question_answers: typeof patch.notify_question_answers === 'boolean' ? patch.notify_question_answers : (existing?.notify_question_answers ?? next.notify_question_answers),
      notify_new_questions: typeof patch.notify_new_questions === 'boolean' ? patch.notify_new_questions : (existing?.notify_new_questions ?? next.notify_new_questions),
      notify_enrollments: typeof patch.notify_enrollments === 'boolean' ? patch.notify_enrollments : (existing?.notify_enrollments ?? next.notify_enrollments),
      updated_at: new Date().toISOString(),
    };

    const { error } = await db.from('user_notification_preferences').upsert(merged, { onConflict: 'user_id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ preferences: merged, storageReady: true }, { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=60' } });
  } catch {
    return NextResponse.json({ error: 'Notification preferences storage is not configured yet.' }, { status: 503 });
  }
}
