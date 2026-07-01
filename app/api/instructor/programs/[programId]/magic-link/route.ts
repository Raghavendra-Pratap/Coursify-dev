import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createServiceClient } from '@/lib/supabase-admin';
import { createProgramMagicToken } from '@/lib/magic-link';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET(
  request: NextRequest,
  { params }: { params: { programId: string } },
) {
  const programId = params?.programId;
  if (!programId) return NextResponse.json({ error: 'Program ID required' }, { status: 400 });
  if (!supabaseUrl || !supabaseAnonKey) return NextResponse.json({ error: 'Server config missing' }, { status: 500 });

  const cookieHeader = request.headers.get('cookie') ?? '';
  const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        const m = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
        return m ? decodeURIComponent(m[1]) : undefined;
      },
      set() {},
      remove() {},
    },
  });
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = createServiceClient();
    const { data: program } = await db
      .from('course_programs')
      .select('id, created_by')
      .eq('id', programId)
      .maybeSingle();
    if (!program || (program as { created_by: string }).created_by !== user.id) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const token = createProgramMagicToken(programId);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const magicLink = `${baseUrl}/go/${token}`;

    return NextResponse.json({ magicLink, token });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create magic link';
    if (message.includes('MAGIC_LINK_SECRET')) return NextResponse.json({ error: message }, { status: 503 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
