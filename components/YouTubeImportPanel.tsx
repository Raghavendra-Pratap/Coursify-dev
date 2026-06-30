'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Youtube, X } from 'lucide-react';
import type { YouTubeImportResult, YouTubeCourseLayout } from '@/lib/youtube-import';
import {
  formatSecondsToHHMMSS,
  defaultSelection,
  buildCourseModulesFromYouTubeImport,
  defaultYouTubeCourseLayout,
  previewYouTubeImportStructure,
  YOUTUBE_COURSE_LAYOUTS,
} from '@/lib/youtube-import';
import { parseYouTubeInputUrl } from '@/lib/youtube-url';

type SelectionMap = Record<string, Set<number>>;

interface YouTubeImportPanelProps {
  open: boolean;
  onClose: () => void;
  onApply: (
    modules: ReturnType<typeof buildCourseModulesFromYouTubeImport>,
    courseTitle?: string,
    layout?: YouTubeCourseLayout
  ) => void;
}

function selectionFromResult(result: YouTubeImportResult): SelectionMap {
  const map: SelectionMap = {};
  for (const pick of defaultSelection(result)) {
    map[pick.videoId] = new Set(pick.chapterIndexes);
  }
  return map;
}

function selectionToPayload(map: SelectionMap): { videoId: string; chapterIndexes: number[] }[] {
  return Object.entries(map)
    .map(([videoId, indexes]) => ({
      videoId,
      chapterIndexes: Array.from(indexes).sort((a, b) => a - b),
    }))
    .filter((p) => p.chapterIndexes.length > 0);
}

export function YouTubeImportPanel({ open, onClose, onApply }: YouTubeImportPanelProps) {
  const [url, setUrl] = useState('');
  const [preferPlaylist, setPreferPlaylist] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<YouTubeImportResult | null>(null);
  const [selection, setSelection] = useState<SelectionMap>({});
  const [expandedVideos, setExpandedVideos] = useState<Set<string>>(new Set());
  const [layout, setLayout] = useState<YouTubeCourseLayout>('lesson_per_chapter');

  const parsed = useMemo(() => (url.trim() ? parseYouTubeInputUrl(url) : null), [url]);
  const showPlaylistToggle = parsed?.kind === 'video' && Boolean(parsed.playlistId);

  const reset = useCallback(() => {
    setUrl('');
    setPreferPlaylist(true);
    setLoading(false);
    setError(null);
    setResult(null);
    setSelection({});
    setExpandedVideos(new Set());
    setLayout('lesson_per_chapter');
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const fetchImport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/instructor/youtube/import', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), preferPlaylist }),
      });
      const data = (await res.json().catch(() => ({}))) as YouTubeImportResult & { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Failed to fetch from YouTube');
        setResult(null);
        return;
      }
      setResult(data);
      setSelection(selectionFromResult(data));
      setExpandedVideos(new Set(data.videos.map((v) => v.videoId)));
      setLayout(defaultYouTubeCourseLayout(data));
    } catch {
      setError('Failed to fetch from YouTube');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const toggleChapter = (videoId: string, chapterIndex: number) => {
    setSelection((prev) => {
      const next = { ...prev };
      const set = new Set(next[videoId] ?? []);
      if (set.has(chapterIndex)) set.delete(chapterIndex);
      else set.add(chapterIndex);
      next[videoId] = set;
      return next;
    });
  };

  const toggleAllChaptersForVideo = (videoId: string, count: number, select: boolean) => {
    setSelection((prev) => ({
      ...prev,
      [videoId]: select ? new Set(Array.from({ length: count }, (_, i) => i)) : new Set(),
    }));
  };

  const handleApply = () => {
    if (!result) return;
    const payload = selectionToPayload(selection);
    if (payload.length === 0) {
      setError('Select at least one chapter to import.');
      return;
    }
    const modules = buildCourseModulesFromYouTubeImport(result, payload, {
      moduleTitle: result.title,
      layout,
    });
    if (modules.length === 0) {
      setError('Nothing selected to import.');
      return;
    }
    onApply(modules, result.title, layout);
    handleClose();
  };

  if (!open) return null;

  const selectedSegmentCount = Object.values(selection).reduce((acc, s) => acc + s.size, 0);
  const structurePreview = result
    ? previewYouTubeImportStructure(result, selectionToPayload(selection), layout)
    : null;
  const layoutOptions = result
    ? YOUTUBE_COURSE_LAYOUTS.filter((opt) => {
        if (opt.playlistOnly && result.videos.length < 2) return false;
        if (opt.hideForSingleVideo && result.videos.length === 1) return false;
        return true;
      })
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Youtube className="w-6 h-6 text-red-600" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Import from YouTube</h3>
          </div>
          <button type="button" onClick={handleClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Paste a YouTube <strong>video</strong>, <strong>playlist</strong>, or <strong>course playlist</strong> link.
            We fetch chapter timestamps so you can map them into modules, lessons, or video segments.
          </p>

          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">YouTube URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=… or …/playlist?list=…"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white"
            />
          </div>

          {showPlaylistToggle && (
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={preferPlaylist}
                onChange={(e) => setPreferPlaylist(e.target.checked)}
                className="rounded border-gray-300"
              />
              Import full playlist (not just this video)
            </label>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          {result && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {result.title}{' '}
                  <span className="font-normal text-gray-500">
                    ({result.sourceType === 'playlist' ? 'playlist' : 'video'} · {result.videos.length} video
                    {result.videos.length !== 1 ? 's' : ''} · {selectedSegmentCount} chapter
                    {selectedSegmentCount !== 1 ? 's' : ''} selected)
                  </span>
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 dark:border-gray-600 p-4 space-y-3 bg-white dark:bg-gray-900/40">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Course structure</p>
                <div className="space-y-2">
                  {layoutOptions.map((opt) => (
                    <label
                      key={opt.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        layout === opt.id
                          ? 'border-red-500 bg-red-50/60 dark:bg-red-950/20'
                          : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="yt-layout"
                        checked={layout === opt.id}
                        onChange={() => setLayout(opt.id)}
                        className="mt-1"
                      />
                      <span>
                        <span className="block text-sm font-medium text-gray-900 dark:text-white">{opt.label}</span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">{opt.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {structurePreview && selectedSegmentCount > 0 && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 pt-1 border-t border-gray-200 dark:border-gray-600">
                    Preview:{' '}
                    <strong>{structurePreview.modules}</strong> module{structurePreview.modules !== 1 ? 's' : ''},{' '}
                    <strong>{structurePreview.lessons}</strong> lesson{structurePreview.lessons !== 1 ? 's' : ''},{' '}
                    <strong>{structurePreview.segments}</strong> video segment{structurePreview.segments !== 1 ? 's' : ''}
                  </p>
                )}
              </div>

              {result.warnings.map((w) => (
                <p key={w} className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 rounded-lg">
                  {w}
                </p>
              ))}

              <div className="border border-gray-200 dark:border-gray-600 rounded-xl divide-y divide-gray-200 dark:divide-gray-600 max-h-[40vh] overflow-y-auto">
                {result.videos.map((video) => {
                  const expanded = expandedVideos.has(video.videoId);
                  const selected = selection[video.videoId] ?? new Set<number>();
                  const allSelected = selected.size === video.chapters.length;
                  return (
                    <div key={video.videoId} className="bg-gray-50/50 dark:bg-gray-900/30">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedVideos((prev) => {
                            const next = new Set(prev);
                            if (next.has(video.videoId)) next.delete(video.videoId);
                            else next.add(video.videoId);
                            return next;
                          })
                        }
                        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-800/50"
                      >
                        {expanded ? <ChevronUp className="w-4 h-4 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 flex-shrink-0" />}
                        <span className="font-medium text-sm text-gray-900 dark:text-white flex-1 truncate">{video.title}</span>
                        <span className="text-xs text-gray-500">{formatSecondsToHHMMSS(video.durationSeconds)}</span>
                      </button>
                      {expanded && (
                        <div className="px-4 pb-3 space-y-1">
                          <button
                            type="button"
                            onClick={() => toggleAllChaptersForVideo(video.videoId, video.chapters.length, !allSelected)}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline mb-2"
                          >
                            {allSelected ? 'Deselect all' : 'Select all'} chapters
                          </button>
                          {video.chapters.map((ch, i) => (
                            <label
                              key={`${video.videoId}-${i}`}
                              className="flex items-start gap-2 text-sm py-1.5 px-2 rounded-lg hover:bg-white dark:hover:bg-gray-800 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selected.has(i)}
                                onChange={() => toggleChapter(video.videoId, i)}
                                className="mt-0.5 rounded border-gray-300"
                              />
                              <span className="flex-1 text-gray-800 dark:text-gray-200">{ch.title}</span>
                              <span className="text-xs text-gray-500 font-mono whitespace-nowrap">
                                {formatSecondsToHHMMSS(ch.startSeconds)} – {formatSecondsToHHMMSS(ch.endSeconds)}
                              </span>
                              {ch.chapterSource !== 'full_video' && (
                                <span className="text-[10px] uppercase tracking-wide text-gray-400">{ch.chapterSource}</span>
                              )}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          {!result ? (
            <button
              type="button"
              disabled={!url.trim() || loading}
              onClick={() => void fetchImport()}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? 'Fetching…' : 'Fetch chapters'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleApply}
              disabled={selectedSegmentCount === 0}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 disabled:opacity-50"
            >
              Add to course
              {structurePreview && selectedSegmentCount > 0
                ? ` (${structurePreview.modules} modules, ${structurePreview.lessons} lessons)`
                : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
