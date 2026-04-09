'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, RotateCcw } from 'lucide-react';

function getYouTubeVideoId(url: string): string | null {
  if (!url?.trim()) return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
  return m ? m[1] : null;
}

function getYouTubeEmbedUrl(videoId: string, startSeconds?: number, endSeconds?: number): string {
  const params = new URLSearchParams();
  if (startSeconds != null && startSeconds > 0) params.set('start', String(Math.floor(startSeconds)));
  if (endSeconds != null && endSeconds > 0) params.set('end', String(Math.floor(endSeconds)));
  params.set('rel', '0');
  params.set('modestbranding', '1');
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

/** Extract Google Drive file ID from share/view/preview or open URL */
function getGoogleDriveFileId(url: string): string | null {
  if (!url?.trim()) return null;
  const m = url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/) ||
    url.match(/drive\.google\.com\/open\?id=([^&]+)/) ||
    url.match(/drive\.google\.com\/uc\?id=([^&]+)/) ||
    url.match(/drive\.google\.com\/thumbnail\?id=([^&]+)/);
  return m ? m[1] : null;
}

/** Build Google Drive embed URL with optional start time (used only as fallback) */
function getGoogleDriveEmbedUrl(fileId: string, startSeconds?: number): string {
  const base = `https://drive.google.com/file/d/${fileId}/preview`;
  if (startSeconds != null && startSeconds > 0) return `${base}?t=${Math.floor(startSeconds)}`;
  return base;
}

function isSharePointOrOneDriveVideoUrl(url: string): boolean {
  if (!url?.trim()) return false;
  try {
    const u = new URL(url.trim());
    const host = u.hostname.toLowerCase();
    return host.endsWith('.sharepoint.com') || host.includes('onedrive.live.com') || host === '1drv.ms';
  } catch {
    return false;
  }
}

function getExternalVideoEmbedUrl(url: string, startSeconds?: number): string {
  const raw = url.trim();
  if (!raw) return raw;
  if (!isSharePointOrOneDriveVideoUrl(raw)) return raw;
  try {
    const u = new URL(raw);
    if (!u.searchParams.has('web')) u.searchParams.set('web', '1');
    if (!u.searchParams.has('download')) u.searchParams.set('download', '0');
    if (startSeconds != null && startSeconds > 0 && !u.searchParams.has('t')) {
      u.searchParams.set('t', String(Math.floor(startSeconds)));
    }
    return u.toString();
  } catch {
    return raw;
  }
}

/** Build our proxy URL for a Drive file so we can play it in <video> with full control (play/pause/seek in sync with timer). */
function getDriveProxyVideoUrl(fileId: string): string {
  const driveDirect = `https://drive.google.com/uc?export=download&id=${fileId}`;
  return `/api/proxy-video?url=${encodeURIComponent(driveDirect)}`;
}

/** True if URL is a direct video file (e.g. .mp4) that <video> can play */
function isDirectVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export type VideoSegment = {
  id: string;
  name: string;
  source?: string;
  source_url?: string | null;
  storage_path?: string | null;
  start_time_seconds?: number;
  end_time_seconds?: number;
  duration_seconds?: number;
};

interface LessonVideoPlayerProps {
  segment: VideoSegment;
  onSegmentComplete: () => void;
  /** Require watching to this fraction (0–1) of segment before firing onSegmentComplete. Default 0.95 */
  completionThreshold?: number;
  /** Optional: report progress 0–1 and duration in seconds for parent (e.g. segmented progress bar) */
  onProgress?: (progress: number, durationSeconds: number) => void;
  /** Optional: when provided, display combined elapsed/total instead of per-segment time. */
  combinedElapsedSeconds?: number;
  combinedDurationSeconds?: number;
}

export function LessonVideoPlayer({
  segment,
  onSegmentComplete,
  completionThreshold = 0.95,
  onProgress,
  combinedElapsedSeconds,
  combinedDurationSeconds,
}: LessonVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** When set, show "Open in Drive" link in error UI (Drive proxy failed). */
  const [errorDriveId, setErrorDriveId] = useState<string | null>(null);
  /** When true, use Drive embed iframe instead of proxy <video> (fallback after proxy error). */
  const [driveProxyFailed, setDriveProxyFailed] = useState(false);
  const ytPlayerRef = useRef<YT.Player | null>(null);
  const onCompleteRef = useRef(onSegmentComplete);
  onCompleteRef.current = onSegmentComplete;
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  const rawUrl = (
    segment.source_url ??
    (segment as { sourceUrl?: string | null }).sourceUrl ??
    (segment as { video_url?: string | null }).video_url ??
    (segment.storage_path && /^https?:\/\//i.test(String(segment.storage_path)) ? segment.storage_path : null)
  )?.trim() || null;
  const url = rawUrl || null;
  const inferredSource = url && getYouTubeVideoId(url) ? 'youtube' : (segment.source ?? (segment as { source?: string }).source ?? 'external_url');
  const source = inferredSource as string;
  const start = segment.start_time_seconds ?? 0;
  const end = segment.end_time_seconds ?? (segment.duration_seconds != null ? segment.duration_seconds + start : undefined);
  const segmentDuration = end != null && start != null ? end - start : segment.duration_seconds ?? 0;
  const segmentBoundsRef = useRef({ start, end, segmentDuration });
  segmentBoundsRef.current = { start, end, segmentDuration };
  const videoUrl = url || (segment.storage_path && /^https?:\/\//i.test(String(segment.storage_path)) ? segment.storage_path : null);
  const driveId = videoUrl ? getGoogleDriveFileId(videoUrl) : null;
  // Drive: prefer proxy + <video> (no Google pop-out / source UI). Iframe preview only if proxy fails (e.g. CORS/size).
  const videoUrlForPlayback = driveId ? getDriveProxyVideoUrl(driveId) : videoUrl;
  const isSharePointLink = !!videoUrl && isSharePointOrOneDriveVideoUrl(videoUrl);
  const useIframe = !!videoUrl && !driveId && !isDirectVideoUrl(videoUrl);
  /** Non-Drive external embeds use iframe. Drive uses iframe only after proxy error (driveProxyFailed). */
  const useIframeForPlayback = useIframe || (!!driveId && driveProxyFailed);

  const markComplete = useCallback(() => {
    setCompleted(true);
    onCompleteRef.current();
  }, []);

  const handleVideoError = useCallback((forDriveId: string | null) => {
    if (forDriveId) {
      setError(null);
      setErrorDriveId(null);
      setDriveProxyFailed(true);
    } else {
      setError('Video could not be loaded. Check the URL or try another browser.');
    }
  }, []);

  const [iframeSegmentComplete, setIframeSegmentComplete] = useState(false);
  const [iframeElapsed, setIframeElapsed] = useState(0);
  const [iframeReplayCount, setIframeReplayCount] = useState(0);
  const iframeReplayKey = `${segment.id}-${iframeReplayCount}`;
  const [iframeTimerStarted, setIframeTimerStarted] = useState(false);
  useEffect(() => {
    setIframeSegmentComplete(false);
    setIframeElapsed(0);
    setIframeTimerStarted(false);
    setDriveProxyFailed(false);
    setErrorDriveId(null);
  }, [segment.id]);
  useEffect(() => {
    setYtDuration(0);
    setVideoDuration(0);
  }, [segment.id]);
  const iframeDurationSeconds = segmentDuration > 0 ? segmentDuration : 60;
  /** For Google Drive we cannot read iframe currentTime; use wall clock and completionThreshold. */
  const iframeMarkCompleteAtSeconds = useMemo(() => {
    if (!useIframeForPlayback) return iframeDurationSeconds;
    if (!driveId) return iframeDurationSeconds;
    const base = segmentDuration > 0 ? segmentDuration : iframeDurationSeconds;
    const atThreshold = Math.max(1, Math.floor(base * completionThreshold));
    return Math.min(iframeDurationSeconds, atThreshold);
  }, [useIframeForPlayback, driveId, segmentDuration, completionThreshold, iframeDurationSeconds]);

  useEffect(() => {
    if (!driveId || !driveProxyFailed) return;
    setIframeTimerStarted(true);
  }, [driveId, driveProxyFailed, segment.id]);

  useEffect(() => {
    if (source === 'youtube' || !useIframeForPlayback || !iframeTimerStarted) return;
    if (!driveId && segmentDuration <= 0) return;
    const id = setInterval(() => {
      setIframeElapsed((prev) => Math.min(prev + 1, iframeDurationSeconds));
    }, 1000);
    return () => clearInterval(id);
  }, [source, useIframeForPlayback, driveId, segmentDuration, iframeTimerStarted, iframeDurationSeconds]);

  useEffect(() => {
    if (!useIframeForPlayback || source === 'youtube') return;
    const report = onProgressRef.current;
    if (typeof report !== 'function' || iframeDurationSeconds <= 0) return;
    report(
      Math.min(1, Math.max(0, iframeElapsed / iframeDurationSeconds)),
      iframeDurationSeconds
    );
  }, [useIframeForPlayback, source, iframeElapsed, iframeDurationSeconds]);

  const iframeCompletedFiredRef = useRef(false);
  useEffect(() => {
    if (!useIframeForPlayback || iframeElapsed < iframeMarkCompleteAtSeconds) return;
    if (iframeCompletedFiredRef.current) return;
    iframeCompletedFiredRef.current = true;
    setIframeSegmentComplete(true);
    markComplete();
  }, [useIframeForPlayback, iframeElapsed, iframeMarkCompleteAtSeconds, markComplete]);
  useEffect(() => {
    iframeCompletedFiredRef.current = false;
  }, [segment.id]);

  const [ytCurrentTime, setYtCurrentTime] = useState(0);
  const [ytDuration, setYtDuration] = useState(0);
  const [ytPlaying, setYtPlaying] = useState(false);
  const [ytMuted, setYtMuted] = useState(false);
  const [ytVolume, setYtVolume] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [ytReady, setYtReady] = useState(false);
  const [readyPlayer, setReadyPlayer] = useState<YT.PlayerInstance | null>(null);

  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const [videoVolume, setVideoVolume] = useState(100);

  // YouTube: load with controls=0; we use a mirror overlay + custom controls
  useEffect(() => {
    if (source !== 'youtube' || !url) return;
    const videoId = getYouTubeVideoId(url);
    if (!videoId) {
      setError('Invalid YouTube URL');
      return;
    }

    const initYouTube = () => {
      if (typeof YT === 'undefined' || !YT.Player) {
        setError('YouTube player failed to load');
        return;
      }
      const el = document.getElementById(`yt-player-${segment.id}`);
      if (!el) return;
      const p = new YT.Player(`yt-player-${segment.id}`, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          // Required to avoid postMessage origin mismatches in some embeds.
          origin: typeof window !== 'undefined' ? window.location.origin : undefined,
          start: Math.floor(start),
          end: end != null ? Math.floor(end) : undefined,
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
        },
        events: {
          onReady: () => {
            ytPlayerRef.current = p as unknown as YT.Player;
            setReadyPlayer(p as unknown as YT.PlayerInstance);
            setYtReady(true);
          },
          onStateChange: (ev: YT.OnStateChangeEvent) => {
            setYtPlaying(ev.data === 1);
            if (ev.data === 1) {
              try {
                const ct = (p as unknown as YT.Player).getCurrentTime?.();
                if (typeof ct === 'number' && ct >= 0) {
                  lastYtTimeSetRef.current = ct;
                  setYtCurrentTime(ct);
                }
              } catch {
                // ignore
              }
            }
            if (ev.data === 0) markComplete();
          },
        },
      });
      ytPlayerRef.current = p as unknown as YT.Player;
    };

    if (typeof YT !== 'undefined' && YT.Player) {
      initYouTube();
      return () => {
        if (ytPlayerRef.current?.destroy) ytPlayerRef.current.destroy();
        ytPlayerRef.current = null;
        setReadyPlayer(null);
        setYtReady(false);
      };
    }
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      initYouTube();
    };
    document.head.appendChild(script);
    return () => {
      if (ytPlayerRef.current?.destroy) ytPlayerRef.current.destroy();
      ytPlayerRef.current = null;
      setReadyPlayer(null);
      setYtReady(false);
    };
  }, [source, url, segment.id, start, end, markComplete]);

  const ytCompletedFromPoll = useRef(false);
  const lastSeekAtRef = useRef(0);
  const lastKnownTimeRef = useRef(0);
  const lastYtTimeSetRef = useRef(-1);
  const SEEK_COOLDOWN_MS = 400;

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Poll YouTube getCurrentTime on an interval so timer and slider stay in sync with playback
  useEffect(() => {
    if (source !== 'youtube' || !readyPlayer) return;
    let mounted = true;
    const POLL_MS = 100;
    const poll = () => {
      if (!mounted) return;
      const player = ytPlayerRef.current;
      if (player?.getCurrentTime) {
        try {
          const t = player.getCurrentTime();
          if (typeof t === 'number' && t >= 0) {
            lastKnownTimeRef.current = t;
            // Always push player time to state so slider moves (no threshold); YouTube can report 0 or small deltas with controls:0
            lastYtTimeSetRef.current = t;
            setYtCurrentTime(t);
            if (end == null && player.getDuration) {
              const d = player.getDuration();
              if (typeof d === 'number' && d > 0) setYtDuration(d);
            }
            // Report progress to parent every poll so segmented bar stays in sync (use ref for current segment)
            const report = onProgressRef.current;
            if (typeof report === 'function') {
              const { start: s, end: e, segmentDuration: sd } = segmentBoundsRef.current;
              const effectiveDuration = sd > 0
                ? sd
                : e != null && e > s
                  ? e - s
                  : (() => {
                      if (player.getDuration) {
                        const d = player.getDuration();
                        if (typeof d === 'number' && d > 0) return Math.max(1, d - s);
                      }
                      return 1;
                    })();
              if (effectiveDuration >= 0.5) {
                const progress = Math.min(1, Math.max(0, (t - s) / effectiveDuration));
                report(progress, effectiveDuration);
              }
            }
            const inSeekCooldown = Date.now() - lastSeekAtRef.current < SEEK_COOLDOWN_MS;
            if (!inSeekCooldown) {
              if (end != null && t >= end - 0.3) {
                if (!ytCompletedFromPoll.current) {
                  ytCompletedFromPoll.current = true;
                  player.pauseVideo?.();
                  markComplete();
                }
              } else if (ytCompletedFromPoll.current && end != null && t < end - 0.5) {
                ytCompletedFromPoll.current = false;
                setCompleted(false);
              }
            }
          }
        } catch {
          // ignore
        }
      }
    };
    const intervalId = setInterval(poll, POLL_MS);
    poll(); // run once immediately so display is in sync as soon as player is ready
    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [source, readyPlayer, start, end, markComplete, segmentDuration]);

  // HTML5 video: timeupdate + clamp + completion; sync state and smooth time when playing (only when direct video is mounted)
  useEffect(() => {
    if (source === 'youtube' || useIframe || !url) return;
    const v = videoRef.current;
    if (!v) return;

    setVideoCurrentTime(v.currentTime);
    setVideoPlaying(!v.paused);

    const handleTimeUpdate = () => {
      const dur = v.duration;
      let current = v.currentTime;
      if (!Number.isFinite(dur) || dur <= 0) return;
      const effectiveEnd = end != null && end > 0 ? Math.min(end, dur) : dur;
      const effectiveStart = start;
      if (current > effectiveEnd) {
        v.currentTime = effectiveEnd;
        current = effectiveEnd;
        v.pause();
      }
      if (current < effectiveStart) {
        v.currentTime = effectiveStart;
        current = effectiveStart;
      }
      setVideoCurrentTime(current);
      setVideoPlaying(!v.paused);
      if (completed) return;
      const segmentLen = effectiveEnd - effectiveStart;
      if (segmentLen < 0.5) return; // don't mark complete for zero or near-zero duration (avoids immediate complete on load)
      const required = segmentLen * completionThreshold + effectiveStart;
      if (current >= required - 0.5) markComplete();
    };

    const handleEnded = () => {
      const dur = v.duration;
      if (!Number.isFinite(dur) || dur <= 0) return;
      const effectiveEnd = end != null && end > 0 ? Math.min(end, dur) : dur;
      if (effectiveEnd - start < 0.5) return; // avoid marking complete for near-zero-length segments
      markComplete();
    };
    const handlePlay = () => setVideoPlaying(true);
    const handlePause = () => setVideoPlaying(false);

    v.addEventListener('timeupdate', handleTimeUpdate);
    v.addEventListener('ended', handleEnded);
    v.addEventListener('play', handlePlay);
    v.addEventListener('pause', handlePause);

    const pollId = setInterval(() => {
      const el = videoRef.current;
      if (!el) return;
      const cur = el.currentTime;
      const dur = el.duration;
      if (!Number.isFinite(dur) || dur <= 0) return;
      if (el.paused) return;
      const effectiveEnd = end != null && end > 0 ? Math.min(end, dur) : dur;
      const effectiveStart = start;
      const clamped = Math.max(effectiveStart, Math.min(effectiveEnd, cur));
      setVideoCurrentTime(clamped);
    }, 80);

    // Report progress to parent so segmented bar updates in sync during playback
    const progressReportMs = 150;
    const MIN_DURATION_TO_REPORT = 0.5;
    const progressReportId = setInterval(() => {
      const el = videoRef.current;
      const report = onProgressRef.current;
      if (!el || typeof report !== 'function') return;
      const dur = el.duration;
      if (!Number.isFinite(dur) || dur <= 0) return;
      const effectiveEnd = end != null && end > 0 ? Math.min(end, dur) : dur;
      const effectiveStart = start;
      const effectiveDuration = Math.max(0, effectiveEnd - effectiveStart);
      if (effectiveDuration < MIN_DURATION_TO_REPORT) return;
      const current = Math.max(effectiveStart, Math.min(effectiveEnd, el.currentTime));
      const progress = Math.min(1, Math.max(0, (current - effectiveStart) / effectiveDuration));
      report(progress, effectiveDuration);
    }, progressReportMs);

    return () => {
      v.removeEventListener('timeupdate', handleTimeUpdate);
      v.removeEventListener('ended', handleEnded);
      v.removeEventListener('play', handlePlay);
      v.removeEventListener('pause', handlePause);
      clearInterval(pollId);
      clearInterval(progressReportId);
    };
  }, [source, useIframe, url, start, end, completed, markComplete, completionThreshold]);

  // Stable key per segment + player mode so React unmounts/remounts when switching (avoids removeChild DOM error)
  const playerMode = error ? 'error' : (source === 'youtube' && url) ? 'youtube' : !videoUrl ? 'nourl' : driveId && driveProxyFailed ? 'drive' : useIframeForPlayback ? 'iframe' : 'video';
  const wrapper = (key: string, children: React.ReactNode) => (
    <div className="w-full h-full min-w-0 min-h-0" data-player-root>
      <div key={key} className="w-full h-full min-w-0 min-h-0">{children}</div>
    </div>
  );

  if (error) {
    return wrapper(
      `${segment.id}-error`,
      <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-red-700 dark:text-red-300 text-sm space-y-2">
        <p>{error}</p>
        {errorDriveId && (
          <a
            href={getGoogleDriveEmbedUrl(errorDriveId)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            Open in Google Drive
          </a>
        )}
      </div>
    );
  }

  if (source === 'youtube' && url) {
    const player = readyPlayer;
    const effectiveDuration = segmentDuration > 0
      ? segmentDuration
      : end != null
        ? end - start
        : ytDuration > 0
          ? Math.max(0.001, ytDuration - start)
          : Math.max(0.001, (end ?? start) - start);
    const progress = effectiveDuration > 0
      ? Math.min(1, Math.max(0, (ytCurrentTime - start) / effectiveDuration))
      : 0;

    const handlePlayPause = () => {
      if (!player) return;
      try {
        if (ytPlaying) {
          player.pauseVideo?.();
        } else {
          // Replay: hide "Segment completed" overlay when user clicks play again
          if (completed) {
            setCompleted(false);
            ytCompletedFromPoll.current = false;
          }
          player.playVideo?.();
        }
      } catch {
        // ignore
      }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!player?.seekTo) return;
      const p = Number(e.target.value);
      const sec = start + p * effectiveDuration;
      try {
        lastSeekAtRef.current = Date.now();
        lastYtTimeSetRef.current = sec;
        player.seekTo(sec, true);
        setYtCurrentTime(sec);
        // If user seeks back before the end, hide "Segment completed" so they can replay
        if (completed && end != null && sec < end - 0.5) {
          setCompleted(false);
          ytCompletedFromPoll.current = false;
        }
      } catch {
        // ignore
      }
    };

    const handleMuteToggle = () => {
      if (!player) return;
      try {
        if (ytMuted) {
          player.unMute?.();
          setYtMuted(false);
        } else {
          player.mute?.();
          setYtMuted(true);
        }
      } catch {
        // ignore
      }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!player?.setVolume) return;
      const v = Number(e.target.value);
      try {
        setYtVolume(v);
        player.setVolume(v);
        setYtMuted(v === 0);
      } catch {
        // ignore
      }
    };

    const toggleFullscreen = () => {
      const el = containerRef.current;
      if (!el) return;
      if (!document.fullscreenElement) {
        el.requestFullscreen?.();
        setIsFullscreen(true);
      } else {
        document.exitFullscreen?.();
        setIsFullscreen(false);
      }
    };

    return wrapper(
      `${segment.id}-youtube`,
      <div
        ref={containerRef}
        className="relative w-full h-full min-w-0 min-h-0 rounded-xl overflow-hidden bg-black"
        style={{ aspectRatio: '16/9' }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div id={`yt-player-${segment.id}`} className="absolute inset-0 w-full h-full" />
        {/* Top bar: same style as bottom control bar, hides YT title/Share without being heavy */}
        <div
          className="absolute top-0 left-0 right-0 h-10 z-10 bg-gradient-to-b from-black/90 to-transparent"
          onContextMenu={(e) => e.preventDefault()}
          aria-hidden
        />
        {/* Mirror overlay: blocks all interaction with iframe; click on video toggles play/pause like YouTube */}
        <div
          className="absolute inset-0 z-10 flex flex-col justify-end cursor-pointer"
          onContextMenu={(e) => e.preventDefault()}
          onClick={handlePlayPause}
          onDoubleClick={(e) => e.preventDefault()}
        >
          {/* Custom control bar - stop propagation so clicking controls doesn't toggle play */}
          <div
            className="bg-gradient-to-t from-black/90 to-transparent px-3 py-2 flex flex-col gap-1.5 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="range"
              min={0}
              max={1}
              step={0.001}
              value={progress}
              onChange={handleSeek}
              className="w-full h-1.5 accent-blue-500 cursor-pointer"
              aria-label="Seek"
            />
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handlePlayPause}
                className="p-1.5 rounded-full text-white hover:bg-white/20 transition-colors"
                aria-label={ytPlaying ? 'Pause' : 'Play'}
              >
                {ytPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <span className="text-white text-sm tabular-nums">
                {formatTime(Math.max(0, ytCurrentTime - start))} / {formatTime(effectiveDuration)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleMuteToggle}
                  className="p-1.5 rounded-full text-white hover:bg-white/20 transition-colors"
                  aria-label={ytMuted ? 'Unmute' : 'Mute'}
                >
                  {ytMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={ytMuted ? 0 : ytVolume}
                  onChange={handleVolumeChange}
                  className="w-16 h-1 accent-blue-500 cursor-pointer"
                  aria-label="Volume"
                />
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="p-1.5 rounded-full text-white hover:bg-white/20 transition-colors"
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
        {completed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/50 rounded-xl z-20">
            <span className="text-white font-medium flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-xs">✓</span>
              Segment completed
            </span>
            <button
              type="button"
              onClick={() => {
                setCompleted(false);
                ytCompletedFromPoll.current = false;
                readyPlayer?.playVideo?.();
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors font-medium"
            >
              <RotateCcw className="w-5 h-5" />
              Replay segment
            </button>
          </div>
        )}
      </div>
    );
  }

  // Non-YouTube: use same approach as course creation preview (iframe for Drive/external, <video> only for direct .mp4 etc.)
  if (!videoUrl) {
    return wrapper(
      `${segment.id}-nourl`,
      <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 text-amber-800 dark:text-amber-200 text-sm">
        No playable URL for this segment. Add a video link in the course editor.
      </div>
    );
  }

  // SharePoint/OneDrive commonly blocks iframe embedding with frame-ancestors/X-Frame-Options.
  // Open in a new tab so the learner can still watch.
  if (isSharePointLink) {
    return wrapper(
      `${segment.id}-sharepoint`,
      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-4">
        <p className="text-sm text-amber-900 dark:text-amber-100 mb-3">
          This SharePoint/OneDrive video cannot be embedded inside the app due to Microsoft security policy.
        </p>
        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center px-3 py-2 rounded-md bg-amber-600 text-white hover:bg-amber-700 text-sm font-medium"
        >
          Open video in new tab
        </a>
      </div>
    );
  }

  // Google Drive fallback: keep source hidden by avoiding Drive iframe UI (no pop-out).
  // If proxy streaming fails, ask user to switch source instead of rendering Google controls.
  if (driveId && driveProxyFailed) {
    return wrapper(
      `${segment.id}-drive-proxy-failed`,
      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-4 text-amber-900 dark:text-amber-100">
        <p className="text-sm mb-2">
          Google Drive direct streaming failed for this video. To keep source UI hidden, the app does not show Drive's embedded player.
        </p>
        <p className="text-xs opacity-80">
          Re-add this video as YouTube or a direct MP4 URL for in-app playback.
        </p>
        {videoUrl && (
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex mt-3 items-center px-3 py-2 rounded-md bg-amber-600 text-white hover:bg-amber-700 text-sm font-medium"
          >
            Open source link
          </a>
        )}
      </div>
    );
  }

  // Other iframe URLs (non-Drive): overlay + simulated timer — still no cross-origin control
  if (useIframeForPlayback) {
    const iframeSrc = getExternalVideoEmbedUrl(videoUrl!, start > 0 ? start : undefined);
    const iframeDuration = segmentDuration > 0 ? segmentDuration : 60;
    const iframeProgress = iframeDuration > 0 ? Math.min(1, iframeElapsed / iframeDuration) : 0;
    const handleIframeFullscreen = () => {
      const el = containerRef.current;
      if (!el) return;
      if (!document.fullscreenElement) {
        el.requestFullscreen?.();
        setIsFullscreen(true);
      } else {
        document.exitFullscreen?.();
        setIsFullscreen(false);
      }
    };
    const handleIframeReplay = () => {
      setCompleted(false);
      setIframeSegmentComplete(false);
      setIframeElapsed(0);
      setIframeTimerStarted(false);
      setIframeReplayCount((c) => c + 1);
    };
    const handleOverlayClick = () => {
      setIframeTimerStarted((prev) => !prev);
    };
    return wrapper(
      `${segment.id}-iframe`,
      <div
        ref={containerRef}
        className="relative w-full rounded-xl overflow-hidden bg-black select-none"
        style={{ aspectRatio: '16/9' }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <iframe
          key={iframeReplayKey}
          title={segment.name}
          src={(completed || iframeSegmentComplete) ? 'about:blank' : iframeSrc}
          className="absolute inset-0 w-full h-full pointer-events-none"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; web-share"
          allowFullScreen
        />
        <div
          className="absolute top-0 left-0 right-0 h-10 z-10 bg-gradient-to-b from-black/90 to-transparent pointer-events-none"
          aria-hidden
        />
        {!(completed || iframeSegmentComplete) && (
        <div
          className="absolute inset-0 z-10 flex flex-col justify-end cursor-pointer"
          onContextMenu={(e) => e.preventDefault()}
          onClick={handleOverlayClick}
          aria-label={iframeTimerStarted ? 'Pause' : 'Play'}
        >
          {!iframeTimerStarted && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 pointer-events-none">
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center">
                <Play className="w-10 h-10 text-white ml-1" fill="currentColor" />
              </div>
              <span className="text-white font-medium mt-3">Click to play</span>
            </div>
          )}
          <div
            className="bg-gradient-to-t from-black/90 to-transparent px-3 py-2 flex flex-col gap-1.5 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="range"
              min={0}
              max={1}
              step={0.001}
              value={iframeProgress}
              readOnly
              className="w-full h-1.5 accent-blue-500 cursor-default"
              aria-label="Segment progress"
            />
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleOverlayClick(); }}
                className="p-1.5 rounded-full text-white hover:bg-white/20 transition-colors"
                aria-label={iframeTimerStarted ? 'Pause' : 'Play'}
              >
                {iframeTimerStarted ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <span className="text-white text-sm tabular-nums">
                {formatTime(iframeElapsed)} / {formatTime(iframeDuration)}
              </span>
              <span className="p-1.5 text-white/70" title="Volume controlled in video area" aria-label="Volume in video area">
                <Volume2 className="w-5 h-5" />
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleIframeFullscreen(); }}
                className="p-1.5 rounded-full text-white hover:bg-white/20 transition-colors"
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
        )}
        {(completed || iframeSegmentComplete) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/50 rounded-xl z-20">
            <span className="text-white font-medium flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-xs">✓</span>
              Segment completed
            </span>
            <button
              type="button"
              onClick={handleIframeReplay}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors font-medium"
            >
              <RotateCcw className="w-5 h-5" />
              Replay segment
            </button>
          </div>
        )}
      </div>
    );
  }

  // Direct video file (.mp4, .webm, etc.): custom controls only (no pop-out, PiP, CC, full-timeline)
  const dur = videoDuration > 0 ? videoDuration : (typeof videoRef.current?.duration === 'number' && Number.isFinite(videoRef.current.duration) ? videoRef.current.duration : 0);
  const effectiveEnd = dur > 0
    ? (end != null && end > 0 ? Math.min(end, dur) : dur)
    : (end ?? start + segmentDuration);
  const effectiveDuration = Math.max(0, effectiveEnd - start);
  const segmentProgress = effectiveDuration > 0
    ? Math.min(1, Math.max(0, (videoCurrentTime - start) / effectiveDuration))
    : 0;
  const showInternalProgressBar = !driveId;
  const displayElapsed = combinedElapsedSeconds != null
    ? Math.max(0, combinedElapsedSeconds)
    : Math.max(0, videoCurrentTime - start);
  const displayTotal = combinedDurationSeconds != null && combinedDurationSeconds > 0
    ? combinedDurationSeconds
    : effectiveDuration;

  const handleVideoPlayPause = () => {
    const el = videoRef.current;
    if (!el) return;
    if (videoPlaying) {
      el.pause();
    } else {
      if (completed) {
        setCompleted(false);
      }
      el.play();
    }
  };

  const handleVideoSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = videoRef.current;
    if (!el || !Number.isFinite(el.duration)) return;
    const p = Number(e.target.value);
    const sec = start + p * effectiveDuration;
    const clamped = Math.max(start, Math.min(effectiveEnd, sec));
    el.currentTime = clamped;
    setVideoCurrentTime(clamped);
    if (completed && end != null && clamped < end - 0.5) setCompleted(false);
  };

  const handleVideoMuteToggle = () => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !videoMuted;
    setVideoMuted(el.muted);
  };

  const handleVideoVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = videoRef.current;
    if (!el) return;
    const val = Number(e.target.value);
    el.volume = val / 100;
    el.muted = val === 0;
    setVideoVolume(val);
    setVideoMuted(val === 0);
  };

  const handleVideoFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  return wrapper(
    `${segment.id}-video`,
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-0 rounded-xl overflow-hidden bg-black"
      onContextMenu={(e) => e.preventDefault()}
    >
      <video
        ref={videoRef}
        src={videoUrlForPlayback ?? ''}
        className="w-full h-full object-contain"
        preload="metadata"
        playsInline
        disablePictureInPicture
        disableRemotePlayback
        controlsList="nodownload nofullscreen noplaybackrate"
        onContextMenu={(e) => e.preventDefault()}
        onError={() => handleVideoError(driveId)}
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          if (typeof el.duration === 'number' && Number.isFinite(el.duration)) setVideoDuration(el.duration);
          if (start > 0 && el.currentTime === 0) el.currentTime = start;
        }}
      />
      {/* Top bar */}
      <div
        className="absolute top-0 left-0 right-0 h-10 z-10 bg-gradient-to-b from-black/90 to-transparent"
        onContextMenu={(e) => e.preventDefault()}
        aria-hidden
      />
      {/* Overlay: click to play/pause; custom controls below */}
      <div
        className="absolute inset-0 z-10 flex flex-col justify-end cursor-pointer"
        onContextMenu={(e) => e.preventDefault()}
        onClick={handleVideoPlayPause}
      >
        <div
          className="bg-gradient-to-t from-black/90 to-transparent px-3 py-2 flex flex-col gap-1.5 cursor-default"
          onClick={(e) => e.stopPropagation()}
        >
          {showInternalProgressBar && (
            <input
              type="range"
              min={0}
              max={1}
              step={0.001}
              value={segmentProgress}
              onChange={handleVideoSeek}
              className="w-full h-1.5 accent-blue-500 cursor-pointer"
              aria-label="Seek within segment"
            />
          )}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleVideoPlayPause}
              className="p-1.5 rounded-full text-white hover:bg-white/20 transition-colors"
              aria-label={videoPlaying ? 'Pause' : 'Play'}
            >
              {videoPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <span className="text-white text-sm tabular-nums">
              {formatTime(displayElapsed)} / {formatTime(displayTotal)}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleVideoMuteToggle}
                className="p-1.5 rounded-full text-white hover:bg-white/20 transition-colors"
                aria-label={videoMuted ? 'Unmute' : 'Mute'}
              >
                {videoMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={videoMuted ? 0 : videoVolume}
                onChange={handleVideoVolumeChange}
                className="w-16 h-1 accent-blue-500 cursor-pointer"
                aria-label="Volume"
              />
              <button
                type="button"
                onClick={handleVideoFullscreen}
                className="p-1.5 rounded-full text-white hover:bg-white/20 transition-colors"
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
      {completed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/50 rounded-xl z-20">
          <span className="text-white font-medium flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-xs">✓</span>
            Segment completed
          </span>
          <button
            type="button"
            onClick={() => {
              const el = videoRef.current;
              if (el) {
                setCompleted(false);
                el.currentTime = start;
                el.play();
              }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors font-medium"
          >
            <RotateCcw className="w-5 h-5" />
            Replay segment
          </button>
        </div>
      )}
    </div>
  );
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
  }
  namespace YT {
    interface PlayerState {
      ENDED: number;
      PLAYING: number;
      PAUSED: number;
      BUFFERING: number;
      CUED: number;
    }
    interface OnStateChangeEvent {
      data: number;
    }
    const PlayerState: PlayerState;
    interface PlayerInstance {
      getCurrentTime?: () => number;
      getDuration?: () => number;
      playVideo?: () => void;
      pauseVideo?: () => void;
      seekTo?(seconds: number, allowSeekAhead: boolean): void;
      setVolume?(volume: number): void;
      getVolume?: () => number;
      mute?: () => void;
      unMute?: () => void;
      destroy?: () => void;
    }
    class Player implements PlayerInstance {
      constructor(id: string, options: unknown);
      getCurrentTime?: () => number;
      getDuration?: () => number;
      playVideo?: () => void;
      pauseVideo?: () => void;
      seekTo?(seconds: number, allowSeekAhead: boolean): void;
      setVolume?(volume: number): void;
      getVolume?: () => number;
      mute?: () => void;
      unMute?: () => void;
      destroy?: () => void;
    }
  }
}
