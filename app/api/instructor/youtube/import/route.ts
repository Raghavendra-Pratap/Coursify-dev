import { NextResponse } from 'next/server';
import { requireInstructor } from '@/lib/instructor-auth';
import { importYouTubeUrl } from '@/lib/youtube-import';

export async function POST(request: Request) {
  const auth = await requireInstructor(request);
  if ('error' in auth) return auth.error;

  let body: { url?: string; preferPlaylist?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json({ error: 'YouTube URL is required' }, { status: 400 });
  }

  try {
    const result = await importYouTubeUrl(url, { preferPlaylist: Boolean(body.preferPlaylist) });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to import from YouTube';
    const status = msg.includes('YOUTUBE_API_KEY') ? 503 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
