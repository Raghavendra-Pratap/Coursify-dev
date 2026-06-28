import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase-admin';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params?.id;
  if (!id) return NextResponse.json({ error: 'Course ID required' }, { status: 400 });
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('courses')
      .select('id, title, description, status')
      .eq('id', id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: 'Could not load course' }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    if (data.status !== 'published') {
      return NextResponse.json({ error: 'Course is not published yet' }, { status: 403 });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
