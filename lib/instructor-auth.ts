import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type InstructorAuth = { error: NextResponse } | { user: User };

export async function requireInstructor(request: Request): Promise<InstructorAuth> {
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

  return { user };
}
