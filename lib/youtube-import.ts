/**
 * Server-side YouTube import: metadata, playlists, and chapter markers for course segmentation.
 */

import { parseYouTubeInputUrl, youTubeWatchUrl, type ParsedYouTubeUrl } from '@/lib/youtube-url';

export type YouTubeChapter = {
  title: string;
  startSeconds: number;
  endSeconds: number;
  chapterSource: 'description' | 'player' | 'full_video';
};

export type YouTubeVideoImport = {
  videoId: string;
  title: string;
  url: string;
  durationSeconds: number;
  chapters: YouTubeChapter[];
};

export type YouTubeImportResult = {
  sourceType: 'video' | 'playlist';
  sourceUrl: string;
  playlistId?: string;
  title: string;
  videos: YouTubeVideoImport[];
  warnings: string[];
};

const MAX_PLAYLIST_VIDEOS = 50;
const YT_API = 'https://www.googleapis.com/youtube/v3';

function youtubeApiKey(): string | undefined {
  return process.env.YOUTUBE_API_KEY?.trim() || undefined;
}

export function parseIso8601Duration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const h = parseInt(m[1] ?? '0', 10);
  const min = parseInt(m[2] ?? '0', 10);
  const s = parseInt(m[3] ?? '0', 10);
  return h * 3600 + min * 60 + s;
}

function formatSecondsToHHMMSS(total: number): string {
  const sec = Math.max(0, Math.floor(total));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

async function ytApiGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = youtubeApiKey();
  if (!key) throw new Error('YouTube API is not configured. Set YOUTUBE_API_KEY in .env.local.');
  const url = new URL(`${YT_API}/${path}`);
  url.searchParams.set('key', key);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `YouTube API error (${res.status})`);
  }
  return res.json() as Promise<T>;
}

function parseTimestampToSeconds(h: number, m: number, s: number): number {
  return h * 3600 + m * 60 + s;
}

function stripLeadingChapterIndex(title: string): string {
  return title.replace(/^\d{1,3}\s+/, '').trim();
}

/** Parse chapter timestamps from video description (creator-defined chapters). */
export function parseChaptersFromDescription(description: string, durationSeconds: number): YouTubeChapter[] {
  if (!description?.trim()) return [];
  const found: { startSeconds: number; title: string }[] = [];

  for (const rawLine of description.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    // Title … HH:MM:SS  (e.g. "04 Immutable and mutable in python 01:06:40")
    const endHms = line.match(/^(.+?)\s+(\d{1,2}):(\d{2}):(\d{2})\s*$/);
    if (endHms) {
      const title = stripLeadingChapterIndex(endHms[1].trim());
      const startSeconds = parseTimestampToSeconds(
        parseInt(endHms[2], 10),
        parseInt(endHms[3], 10),
        parseInt(endHms[4], 10)
      );
      if (title && startSeconds <= durationSeconds + 5) {
        found.push({ startSeconds, title });
        continue;
      }
    }

    // Title … MM:SS when line looks like a numbered chapter row
    const endMs = line.match(/^(\d{1,3}\s+.+?)\s+(\d{1,2}):(\d{2})\s*$/);
    if (endMs && !endMs[1].includes(':')) {
      const title = stripLeadingChapterIndex(endMs[1].trim());
      const startSeconds = parseTimestampToSeconds(0, parseInt(endMs[2], 10), parseInt(endMs[3], 10));
      if (title && startSeconds <= durationSeconds + 5) {
        found.push({ startSeconds, title });
        continue;
      }
    }

    // HH:MM:SS … Title  (classic YouTube chapter list)
    let match =
      line.match(/^[\s*\-•]*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s*[-–—:|]\s*(.+)$/) ||
      line.match(/^[\s*\-•]*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s+(.+)$/);
    if (!match) {
      match = line.match(/^[\s*\-•]*(\d{1,2}):(\d{2})\s*[-–—:|]\s*(.+)$/) || line.match(/^[\s*\-•]*(\d{1,2}):(\d{2})\s+(.+)$/);
      if (match) {
        const startSeconds = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
        const title = stripLeadingChapterIndex(match[3].trim());
        if (title && startSeconds <= durationSeconds + 5) found.push({ startSeconds, title });
        continue;
      }
      continue;
    }

    const hours = match[1] ? parseInt(match[1], 10) : 0;
    const minutes = parseInt(match[2], 10);
    const seconds = parseInt(match[3], 10);
    const title = stripLeadingChapterIndex(match[4].trim());
    const startSeconds = parseTimestampToSeconds(hours, minutes, seconds);
    if (title && startSeconds <= durationSeconds + 5) found.push({ startSeconds, title });
  }

  if (found.length < 2) return [];

  const unique = found
    .sort((a, b) => a.startSeconds - b.startSeconds)
    .filter((ch, i, arr) => i === 0 || ch.startSeconds > arr[i - 1].startSeconds);

  return unique.map((ch, i) => {
    const endSeconds = i < unique.length - 1 ? unique[i + 1].startSeconds : durationSeconds;
    return {
      title: ch.title,
      startSeconds: ch.startSeconds,
      endSeconds: Math.max(ch.startSeconds + 1, endSeconds),
      chapterSource: 'description' as const,
    };
  });
}

function collectChapterRenderers(node: unknown, out: { title: string; startMs: number }[] = []): typeof out {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const item of node) collectChapterRenderers(item, out);
    return out;
  }
  const rec = node as Record<string, unknown>;
  if (rec.chapterRenderer && typeof rec.chapterRenderer === 'object') {
    const cr = rec.chapterRenderer as {
      title?: { simpleText?: string; runs?: { text?: string }[] };
      timeRangeStartMillis?: number | string;
    };
    const title = cr.title?.simpleText || cr.title?.runs?.[0]?.text;
    const startMs = Number(cr.timeRangeStartMillis);
    if (title && Number.isFinite(startMs)) out.push({ title, startMs });
  }
  for (const v of Object.values(rec)) collectChapterRenderers(v, out);
  return out;
}

/** Best-effort player chapters (auto-generated or creator markers) without API key. */
async function fetchPlayerChapters(videoId: string, durationSeconds: number): Promise<YouTubeChapter[]> {
  try {
    const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId,
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20241120.01.00',
            hl: 'en',
          },
        },
      }),
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = await res.json();
    const markers = collectChapterRenderers(data)
      .sort((a, b) => a.startMs - b.startMs)
      .filter((m, i, arr) => i === 0 || m.startMs > arr[i - 1].startMs);

    if (markers.length < 2) return [];

    return markers.map((m, i) => {
      const startSeconds = Math.floor(m.startMs / 1000);
      const endSeconds =
        i < markers.length - 1 ? Math.floor(markers[i + 1].startMs / 1000) : durationSeconds;
      return {
        title: m.title,
        startSeconds,
        endSeconds: Math.max(startSeconds + 1, endSeconds),
        chapterSource: 'player' as const,
      };
    });
  } catch {
    return [];
  }
}

async function fetchVideoDetails(videoId: string): Promise<{
  title: string;
  description: string;
  durationSeconds: number;
}> {
  const data = await ytApiGet<{
    items?: { snippet?: { title?: string; description?: string }; contentDetails?: { duration?: string } }[];
  }>('videos', {
    part: 'snippet,contentDetails',
    id: videoId,
  });
  const item = data.items?.[0];
  if (!item) throw new Error(`YouTube video not found: ${videoId}`);
  return {
    title: item.snippet?.title?.trim() || 'YouTube Video',
    description: item.snippet?.description ?? '',
    durationSeconds: parseIso8601Duration(item.contentDetails?.duration ?? 'PT0S'),
  };
}

async function fetchPlaylistMeta(playlistId: string): Promise<string> {
  const data = await ytApiGet<{ items?: { snippet?: { title?: string } }[] }>('playlists', {
    part: 'snippet',
    id: playlistId,
  });
  return data.items?.[0]?.snippet?.title?.trim() || 'YouTube Playlist';
}

async function fetchPlaylistVideoIds(playlistId: string): Promise<string[]> {
  const ids: string[] = [];
  let pageToken = '';
  while (ids.length < MAX_PLAYLIST_VIDEOS) {
    const data = await ytApiGet<{
      items?: { snippet?: { resourceId?: { videoId?: string } } }[];
      nextPageToken?: string;
    }>('playlistItems', {
      part: 'snippet',
      playlistId,
      maxResults: '50',
      ...(pageToken ? { pageToken } : {}),
    });
    for (const item of data.items ?? []) {
      const id = item.snippet?.resourceId?.videoId;
      if (id) ids.push(id);
    }
    if (!data.nextPageToken || ids.length >= MAX_PLAYLIST_VIDEOS) break;
    pageToken = data.nextPageToken;
  }
  return ids.slice(0, MAX_PLAYLIST_VIDEOS);
}

async function buildVideoImport(videoId: string): Promise<YouTubeVideoImport> {
  const details = await fetchVideoDetails(videoId);
  let chapters = parseChaptersFromDescription(details.description, details.durationSeconds);
  if (chapters.length === 0) {
    chapters = await fetchPlayerChapters(videoId, details.durationSeconds);
  }

  if (chapters.length === 0 && details.durationSeconds > 0) {
    chapters = [
      {
        title: details.title,
        startSeconds: 0,
        endSeconds: details.durationSeconds,
        chapterSource: 'full_video',
      },
    ];
  }

  return {
    videoId,
    title: details.title,
    url: youTubeWatchUrl(videoId),
    durationSeconds: details.durationSeconds,
    chapters,
  };
}

export type ImportYouTubeOptions = {
  /** When URL includes both video and playlist, import the full playlist. */
  preferPlaylist?: boolean;
};

export async function importYouTubeUrl(
  inputUrl: string,
  options: ImportYouTubeOptions = {}
): Promise<YouTubeImportResult> {
  const parsed = parseYouTubeInputUrl(inputUrl);
  if (!parsed) throw new Error('Enter a valid YouTube video or playlist URL.');

  const warnings: string[] = [];
  const sourceUrl = inputUrl.trim();

  if (parsed.kind === 'playlist' || (options.preferPlaylist && parsed.kind === 'video' && parsed.playlistId)) {
    const playlistId = parsed.kind === 'playlist' ? parsed.playlistId : parsed.playlistId!;
    const [playlistTitle, videoIds] = await Promise.all([
      fetchPlaylistMeta(playlistId),
      fetchPlaylistVideoIds(playlistId),
    ]);
    if (videoIds.length === 0) throw new Error('Playlist has no public videos.');
    if (videoIds.length >= MAX_PLAYLIST_VIDEOS) {
      warnings.push(`Only the first ${MAX_PLAYLIST_VIDEOS} playlist videos were imported.`);
    }

    const videos: YouTubeVideoImport[] = [];
    for (const videoId of videoIds) {
      try {
        videos.push(await buildVideoImport(videoId));
      } catch {
        warnings.push(`Skipped unavailable video ${videoId}.`);
      }
    }
    if (videos.length === 0) throw new Error('Could not load any videos from this playlist.');

    return {
      sourceType: 'playlist',
      sourceUrl,
      playlistId,
      title: playlistTitle,
      videos,
      warnings,
    };
  }

  const videoId = parsed.kind === 'video' ? parsed.videoId : null;
  if (!videoId) throw new Error('Could not determine YouTube video ID.');

  const video = await buildVideoImport(videoId);
  return {
    sourceType: 'video',
    sourceUrl,
    playlistId: parsed.kind === 'video' ? parsed.playlistId : undefined,
    title: video.title,
    videos: [video],
    warnings,
  };
}

/** Format seconds for display (MM:SS or H:MM:SS). */
export { formatSecondsToHHMMSS };

export type YouTubeImportModule = {
  id: number;
  title: string;
  order: number;
  duration: string;
  lessons: {
    id: number;
    title: string;
    order: number;
    duration: string;
    content: {
      id: number;
      type: 'video';
      order: number;
      videoSegment: {
        id: number;
        name: string;
        duration: string;
        startTime: string;
        endTime: string;
        startTimestamp: number;
        endTimestamp: number;
        status: 'active';
        size: string;
        lastEdited: string;
        source: 'youtube';
        sourceUrl: string;
      };
    }[];
  }[];
};

/** How imported chapters/videos map into the course hierarchy. */
export type YouTubeCourseLayout =
  | 'segments_one_lesson'
  | 'segments_lesson_per_video'
  | 'lesson_per_chapter'
  | 'module_per_video'
  | 'module_per_chapter';

export const YOUTUBE_COURSE_LAYOUTS: {
  id: YouTubeCourseLayout;
  label: string;
  description: string;
  /** Hide for single-video imports when redundant with another option. */
  hideForSingleVideo?: boolean;
  /** Only show when playlist has multiple videos. */
  playlistOnly?: boolean;
}[] = [
  {
    id: 'segments_one_lesson',
    label: 'One lesson',
    description: 'All chapters become video segments in a single lesson.',
  },
  {
    id: 'segments_lesson_per_video',
    label: 'One lesson per video',
    description: 'Each video is a lesson; chapters inside it are segments.',
    hideForSingleVideo: true,
  },
  {
    id: 'lesson_per_chapter',
    label: 'One lesson per chapter',
    description: 'Each chapter is its own lesson with one video segment.',
  },
  {
    id: 'module_per_video',
    label: 'One module per video',
    description: 'Each video is a module; chapters inside it are lessons.',
    playlistOnly: true,
  },
  {
    id: 'module_per_chapter',
    label: 'One module per chapter',
    description: 'Each chapter is its own module with one lesson.',
  },
];

type SelectedChapter = {
  video: YouTubeVideoImport;
  chapter: YouTubeChapter;
};

type YouTubeImportModuleLesson = YouTubeImportModule['lessons'][number];
type YouTubeImportModuleContent = YouTubeImportModuleLesson['content'][number];

function chapterDurationSeconds(ch: YouTubeChapter): number {
  return Math.max(1, ch.endSeconds - ch.startSeconds);
}

function sumContentDuration(content: YouTubeImportModuleContent[]): number {
  return content.reduce((acc, c) => acc + chapterDurationSeconds({
    title: '',
    startSeconds: c.videoSegment.startTimestamp,
    endSeconds: c.videoSegment.endTimestamp,
    chapterSource: 'full_video',
  }), 0);
}

function makeSegmentContent(
  video: YouTubeVideoImport,
  chapter: YouTubeChapter,
  id: number,
  order: number
): YouTubeImportModuleContent {
  const dur = chapterDurationSeconds(chapter);
  return {
    id,
    type: 'video',
    order,
    videoSegment: {
      id,
      name: chapter.title,
      duration: formatSecondsToHHMMSS(dur),
      startTime: formatSecondsToHHMMSS(chapter.startSeconds),
      endTime: formatSecondsToHHMMSS(chapter.endSeconds),
      startTimestamp: chapter.startSeconds,
      endTimestamp: chapter.endSeconds,
      status: 'active',
      size: 'N/A',
      lastEdited: 'Just now',
      source: 'youtube',
      sourceUrl: video.url,
    },
  };
}

function makeLesson(title: string, content: YouTubeImportModuleContent[], id: number, order: number): YouTubeImportModuleLesson {
  return {
    id,
    title,
    order,
    duration: formatSecondsToHHMMSS(sumContentDuration(content)),
    content,
  };
}

function makeModule(title: string, lessons: YouTubeImportModuleLesson[], id: number, order: number): YouTubeImportModule {
  const durationSec = lessons.reduce((acc, l) => acc + sumContentDuration(l.content), 0);
  return {
    id,
    title,
    order,
    duration: formatSecondsToHHMMSS(durationSec),
    lessons,
  };
}

function collectSelectedChapters(
  result: YouTubeImportResult,
  selected: { videoId: string; chapterIndexes: number[] }[]
): SelectedChapter[] {
  const items: SelectedChapter[] = [];
  for (const video of result.videos) {
    const pick = selected.find((s) => s.videoId === video.videoId);
    if (!pick || pick.chapterIndexes.length === 0) continue;
    for (const i of [...pick.chapterIndexes].sort((a, b) => a - b)) {
      const chapter = video.chapters[i];
      if (chapter) items.push({ video, chapter });
    }
  }
  return items;
}

export function previewYouTubeImportStructure(
  result: YouTubeImportResult,
  selected: { videoId: string; chapterIndexes: number[] }[],
  layout: YouTubeCourseLayout
): { modules: number; lessons: number; segments: number } {
  const chapters = collectSelectedChapters(result, selected);
  const segmentCount = chapters.length;
  if (segmentCount === 0) return { modules: 0, lessons: 0, segments: 0 };

  const videoCount = new Set(chapters.map((c) => c.video.videoId)).size;

  switch (layout) {
    case 'segments_one_lesson':
      return { modules: 1, lessons: 1, segments: segmentCount };
    case 'segments_lesson_per_video':
      return { modules: 1, lessons: videoCount, segments: segmentCount };
    case 'lesson_per_chapter':
      return { modules: 1, lessons: segmentCount, segments: segmentCount };
    case 'module_per_video':
      return { modules: videoCount, lessons: segmentCount, segments: segmentCount };
    case 'module_per_chapter':
      return { modules: segmentCount, lessons: segmentCount, segments: segmentCount };
    default:
      return { modules: 1, lessons: 1, segments: segmentCount };
  }
}

export function defaultYouTubeCourseLayout(result: YouTubeImportResult): YouTubeCourseLayout {
  return result.videos.length > 1 ? 'segments_lesson_per_video' : 'lesson_per_chapter';
}

export function buildCourseModulesFromYouTubeImport(
  result: YouTubeImportResult,
  selected: { videoId: string; chapterIndexes: number[] }[],
  options?: { moduleTitle?: string; layout?: YouTubeCourseLayout; /** @deprecated use layout */ lessonPerVideo?: boolean }
): YouTubeImportModule[] {
  const layout =
    options?.layout ??
    (options?.lessonPerVideo === false ? 'segments_one_lesson' : defaultYouTubeCourseLayout(result));
  const moduleTitle = options?.moduleTitle?.trim() || result.title;
  const baseId = Date.now();
  const chapters = collectSelectedChapters(result, selected);
  if (chapters.length === 0) return [];

  let idCounter = 0;
  const nextId = () => baseId + ++idCounter;

  const segmentsForChapters = (items: SelectedChapter[]): YouTubeImportModuleContent[] =>
    items.map((item, i) => makeSegmentContent(item.video, item.chapter, nextId(), i));

  switch (layout) {
    case 'segments_one_lesson': {
      const content = segmentsForChapters(chapters);
      const lesson = makeLesson(moduleTitle, content, nextId(), 0);
      return [makeModule(moduleTitle, [lesson], baseId, 0)];
    }
    case 'segments_lesson_per_video': {
      const lessons: YouTubeImportModuleLesson[] = [];
      let lessonOrder = 0;
      for (const video of result.videos) {
        const items = chapters.filter((c) => c.video.videoId === video.videoId);
        if (items.length === 0) continue;
        lessons.push(makeLesson(video.title, segmentsForChapters(items), nextId(), lessonOrder++));
      }
      return [makeModule(moduleTitle, lessons, baseId, 0)];
    }
    case 'lesson_per_chapter': {
      const lessons = chapters.map((item, i) =>
        makeLesson(item.chapter.title, segmentsForChapters([item]), nextId(), i)
      );
      return [makeModule(moduleTitle, lessons, baseId, 0)];
    }
    case 'module_per_video': {
      const modules: YouTubeImportModule[] = [];
      let moduleOrder = 0;
      for (const video of result.videos) {
        const items = chapters.filter((c) => c.video.videoId === video.videoId);
        if (items.length === 0) continue;
        const lessons = items.map((item, i) =>
          makeLesson(item.chapter.title, segmentsForChapters([item]), nextId(), i)
        );
        modules.push(makeModule(video.title, lessons, nextId(), moduleOrder++));
      }
      return modules;
    }
    case 'module_per_chapter': {
      return chapters.map((item, i) => {
        const lesson = makeLesson(item.chapter.title, segmentsForChapters([item]), nextId(), 0);
        return makeModule(item.chapter.title, [lesson], nextId(), i);
      });
    }
    default:
      return [];
  }
}

export function defaultSelection(result: YouTubeImportResult): { videoId: string; chapterIndexes: number[] }[] {
  return result.videos.map((v) => ({
    videoId: v.videoId,
    chapterIndexes: v.chapters.map((_, i) => i),
  }));
}

export type { ParsedYouTubeUrl } from '@/lib/youtube-url';
