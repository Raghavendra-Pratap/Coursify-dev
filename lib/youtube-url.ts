/** Parse YouTube watch, youtu.be, embed, and playlist URLs. */
export type ParsedYouTubeUrl =
  | { kind: 'video'; videoId: string; playlistId?: string }
  | { kind: 'playlist'; playlistId: string };

export function extractYouTubeVideoId(url: string): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.replace(/^\//, '').split('/')[0];
      return id || null;
    }
    if (u.pathname.includes('/embed/')) {
      const id = u.pathname.split('/embed/')[1]?.split(/[/?#]/)[0];
      return id || null;
    }
    const v = u.searchParams.get('v');
    return v || null;
  } catch {
    const m = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#/]+)/);
    return m?.[1] ?? null;
  }
}

export function extractYouTubePlaylistId(url: string): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    const list = u.searchParams.get('list');
    if (list) return list;
    if (u.pathname.includes('/playlist')) return u.searchParams.get('list');
    return null;
  } catch {
    const m = trimmed.match(/[?&]list=([^&\n#]+)/);
    return m?.[1] ?? null;
  }
}

export function parseYouTubeInputUrl(url: string): ParsedYouTubeUrl | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;

  const playlistId = extractYouTubePlaylistId(trimmed);
  const videoId = extractYouTubeVideoId(trimmed);

  try {
    const u = new URL(trimmed);
    const isPlaylistPath = u.pathname.includes('/playlist');
    if (isPlaylistPath && playlistId) return { kind: 'playlist', playlistId };
    if (playlistId && !videoId) return { kind: 'playlist', playlistId };
    if (videoId) return { kind: 'video', videoId, playlistId: playlistId ?? undefined };
  } catch {
    // fall through
  }

  if (playlistId && !videoId) return { kind: 'playlist', playlistId };
  if (videoId) return { kind: 'video', videoId, playlistId: playlistId ?? undefined };
  return null;
}

export function youTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
