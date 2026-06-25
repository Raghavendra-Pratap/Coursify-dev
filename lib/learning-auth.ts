import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { createServerClient as createServiceClient } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type LearnerAuth =
  | { error: NextResponse }
  | { user: User; enrollment: { id: string }; db: SupabaseClient };

export async function requireLearner(request: Request, courseId: string): Promise<LearnerAuth> {
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
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const db = createServiceClient();
  const { data: enrollment } = await db
    .from('enrollments')
    .select('id')
    .eq('course_id', courseId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!enrollment) {
    return { error: NextResponse.json({ error: 'Not enrolled in this course' }, { status: 403 }) };
  }

  return { user, enrollment: enrollment as { id: string }, db };
}
