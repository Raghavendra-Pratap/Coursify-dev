'use client'

import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Plus, Clock, Video, ChevronRight, Edit, X, Save, Zap, Folder, Upload, Eye, RotateCcw,
  Trash2, CheckCircle, Info, ChevronDown, ChevronUp, Download, Copy, FileText, Menu,
  Youtube, HelpCircle, Radio, AlertCircle, BookOpen, Link
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface CreateCourseProps {
  setCurrentView: (view: string) => void;
}

// Updated data structure: Lessons contain content items (video segments, quizzes, forms, reading)
type ContentType = 'video' | 'quiz' | 'form' | 'reading';
type VideoSource = 'upload' | 'google_drive' | 'youtube' | 'external_url';

interface VideoSegment {
  id: number;
  name: string;
  duration: string;
  startTime: string;
  endTime: string;
  status: 'active' | 'processing';
  size: string;
  lastEdited: string;
  source: VideoSource;
  sourceUrl?: string; // For YouTube or Google Drive
  startTimestamp?: number; // For streaming: start time in seconds
  endTimestamp?: number; // For streaming: end time in seconds
}

interface QuizQuestion {
  id: number;
  question: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer';
  options?: string[];
  correctAnswer: string | number;
  required: boolean;
}

interface Quiz {
  id: number;
  title: string;
  questions: QuizQuestion[];
  passingScore: number;
}

// Reading material: link (Google Doc, Microsoft Doc, etc.) or native in-app text
interface ReadingMaterial {
  title: string;
  type: 'url' | 'native';
  url?: string;
  body?: string;
}

interface ContentItem {
  id: number;
  type: ContentType;
  order: number;
  videoSegment?: VideoSegment;
  quiz?: Quiz;
  form?: any; // Form structure similar to quiz
  reading?: ReadingMaterial;
}

interface Lesson {
  id: number;
  title: string;
  order: number;
  content: ContentItem[]; // Can have multiple content items (videos, quizzes, forms)
  duration: string;
}

interface Module {
  id: number;
  title: string;
  order: number;
  lessons: Lesson[];
  duration: string;
}

/** Extract YouTube video ID from watch or youtu.be URL */
function getYouTubeVideoId(url: string): string | null {
  if (!url?.trim()) return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
  return m ? m[1] : null;
}

/** Build YouTube embed URL with optional start/end and limited UI options */
function getYouTubeEmbedUrl(videoId: string, startSeconds?: number, endSeconds?: number): string {
  const params = new URLSearchParams();
  if (startSeconds != null && startSeconds > 0) params.set('start', String(Math.floor(startSeconds)));
  if (endSeconds != null && endSeconds > 0) params.set('end', String(Math.floor(endSeconds)));
  params.set('rel', '0');           // No related videos at end (or only from same channel)
  params.set('modestbranding', '1'); // Minimal YouTube logo
  params.set('iv_load_policy', '3'); // Hide video annotations
  params.set('disablekb', '0');      // Keep keyboard controls
  const qs = params.toString();
  return `https://www.youtube.com/embed/${videoId}?${qs}`;
}

/** Detect video link type from URL. Returns source type or null if not a recognized video URL. */
function detectVideoLinkType(url: string): VideoSource | null {
  const u = url?.trim() || '';
  if (!u) return null;
  if (getYouTubeVideoId(u)) return 'youtube';
  if (getGoogleDriveFileId(u)) return 'google_drive';
  if (u.startsWith('http://') || u.startsWith('https://')) return 'external_url';
  return null;
}

/** Extract Google Drive file ID from share/view or open URL (for public viewing) */
function getGoogleDriveFileId(url: string): string | null {
  if (!url?.trim()) return null;
  const m = url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/) ||
    url.match(/drive\.google\.com\/open\?id=([^&]+)/) ||
    url.match(/drive\.google\.com\/uc\?id=([^&]+)/);
  return m ? m[1] : null;
}

/** Build Google Drive embed/preview URL with optional start time (Drive supports ?t= seconds) */
function getGoogleDriveEmbedUrl(fileId: string, startSeconds?: number): string {
  const base = `https://drive.google.com/file/d/${fileId}/preview`;
  if (startSeconds != null && startSeconds > 0) {
    return `${base}?t=${Math.floor(startSeconds)}`;
  }
  return base;
}

/** Parse HH:MM:SS to seconds. Returns null if invalid. */
function parseHHMMSSToSeconds(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const parts = t.split(':').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const [h, m, sec] = parts;
  if (m < 0 || m > 59 || sec < 0 || sec > 59 || h < 0) return null;
  return h * 3600 + m * 60 + sec;
}

/** Format seconds as HH:MM:SS (e.g. 90 → "00:01:30"). */
function formatSecondsToHHMMSS(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map(n => n.toString().padStart(2, '0')).join(':');
}

/**
 * Iframe player that enforces segment end for sources we can't control (Google Drive, external).
 * After (endSeconds - startSeconds), hides the iframe and shows "Segment ended" + Replay.
 * Drive embed URL should already include start time (?t=).
 */
function SegmentEnforcedIframePlayer({
  embedUrl,
  startSeconds = 0,
  endSeconds,
  title,
  className = '',
}: {
  embedUrl: string;
  startSeconds?: number;
  endSeconds?: number;
  title: string;
  className?: string;
}) {
  const [segmentEnded, setSegmentEnded] = useState(false);
  const [replayKey, setReplayKey] = useState(0);
  const durationSeconds = endSeconds != null && endSeconds > startSeconds ? endSeconds - startSeconds : 0;

  useEffect(() => {
    if (durationSeconds <= 0 || segmentEnded) return;
    const t = setTimeout(() => setSegmentEnded(true), durationSeconds * 1000);
    return () => clearTimeout(t);
  }, [durationSeconds, segmentEnded, replayKey]);

  const handleReplay = () => {
    setSegmentEnded(false);
    setReplayKey((k) => k + 1);
  };

  if (segmentEnded) {
    return (
      <div className={`${className} flex flex-col items-center justify-center bg-gray-900`}>
        <p className="text-white font-semibold mb-3">Segment ended</p>
        <button
          type="button"
          onClick={handleReplay}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Replay segment
        </button>
      </div>
    );
  }

  return (
    <iframe
      key={replayKey}
      title={title}
      src={embedUrl}
      className={className}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
    />
  );
}

/** YouTube embed that enforces segment end (uses IFrame API to pause at end time) */
function YouTubeSegmentPlayer({
  videoId,
  startSeconds = 0,
  endSeconds,
  title,
  className = '',
}: {
  videoId: string;
  startSeconds?: number;
  endSeconds?: number;
  title?: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<unknown>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !videoId) return;

    const loadApi = (): Promise<void> => {
      if (typeof window !== 'undefined' && (window as unknown as { YT?: { Player: unknown } }).YT?.Player) {
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        const existing = document.getElementById('youtube-iframe-api');
        if (existing) {
          (window as unknown as { onYouTubeIframeAPIReady?: () => void }).onYouTubeIframeAPIReady = () => resolve();
          return;
        }
        const script = document.createElement('script');
        script.id = 'youtube-iframe-api';
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        (window as unknown as { onYouTubeIframeAPIReady?: () => void }).onYouTubeIframeAPIReady = () => resolve();
        document.head.appendChild(script);
      });
    };

    loadApi().then(() => {
      type YTPlayer = { getCurrentTime?: () => number; pauseVideo?: () => void; seekTo?: (s: number) => void; destroy?: () => void };
      const YT = (window as unknown as { YT?: { Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer } }).YT;
      if (!YT || !container) return;

      const player = new YT.Player(container, {
        videoId,
        playerVars: {
          start: Math.floor(startSeconds),
          end: endSeconds != null && endSeconds > 0 ? Math.floor(endSeconds) : undefined,
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
        },
        events: {},
      }) as YTPlayer;

      playerRef.current = player;

      // Enforce segment: learner cannot play before start or past end
      const hasBounds = endSeconds != null && endSeconds > 0;
      if (hasBounds || startSeconds > 0) {
        intervalRef.current = setInterval(() => {
          try {
            const current = player.getCurrentTime?.();
            if (typeof current !== 'number') return;
            if (current < startSeconds - 0.3) {
              player.seekTo?.(startSeconds);
            }
            if (hasBounds && current >= endSeconds - 0.3) {
              player.seekTo?.(endSeconds);
              player.pauseVideo?.();
            }
          } catch {
            // ignore
          }
        }, 500);
      }
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      try {
        const p = playerRef.current as { destroy?: () => void };
        if (p?.destroy) p.destroy();
      } catch {
        // ignore
      }
      playerRef.current = null;
    };
  }, [videoId, startSeconds, endSeconds]);

  return <div ref={containerRef} className={className} title={title} />;
}

const CreateCourse: React.FC<CreateCourseProps> = ({ setCurrentView }) => {
  const [currentModule, setCurrentModule] = useState(0);
  const [currentLesson, setCurrentLesson] = useState(0);
  const [selectedContent, setSelectedContent] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadType, setUploadType] = useState<'file' | 'link'>('file');
  const [unifiedVideoUrl, setUnifiedVideoUrl] = useState('');
  const [contentToReplace, setContentToReplace] = useState<{lessonId: number, contentId: number} | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [segmentName, setSegmentName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState('');
  const [videoMaxDuration, setVideoMaxDuration] = useState(''); // Optional HH:MM:SS for validation
  const [startTimeError, setStartTimeError] = useState<string | null>(null);
  const [endTimeError, setEndTimeError] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [draggedItem, setDraggedItem] = useState<{type: 'module' | 'lesson' | 'content', id: number, moduleId?: number, lessonId?: number} | null>(null);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizModalTitle, setQuizModalTitle] = useState('');
  const [quizModalPassingScore, setQuizModalPassingScore] = useState(70);
  const [showStreamSettings, setShowStreamSettings] = useState(false);
  const [savedCourseId, setSavedCourseId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [editingModuleId, setEditingModuleId] = useState<number | null>(null);
  const [showReadingModal, setShowReadingModal] = useState(false);
  const [readingTitle, setReadingTitle] = useState('');
  const [readingType, setReadingType] = useState<'url' | 'native'>('url');
  const [readingUrl, setReadingUrl] = useState('');
  const [readingBody, setReadingBody] = useState('');

  const showSaveMessage = (msg: string) => {
    setSaveMessage(msg);
    setTimeout(() => setSaveMessage(null), 4000);
  };

  // Updated course structure: Modules -> Lessons -> Content Items (videos/quizzes/forms)
  const [courseData, setCourseData] = useState<{
    title: string;
    description: string;
    lastEdited: string;
    status: 'draft' | 'published';
    modules: Module[];
  }>({
    title: 'Untitled Course',
    description: '',
    lastEdited: 'Just now',
    status: 'draft',
    modules: []
  });

  // Version history (loaded from course_versions when savedCourseId is set)
  const [versions, setVersions] = useState<{ id: number; name: string; changes: string; timestamp: string; isCurrent: boolean; author: string }[]>([]);

  // Drive files (populated when Google Drive is connected)
  const [driveFiles] = useState<{ id: number; name: string; size: string; type: string; modified: string }[]>([]);

  const currentModuleData = courseData.modules[currentModule];
  const currentLessonData = currentModuleData?.lessons[currentLesson];
  const currentContent = currentLessonData?.content?.[selectedContent];

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, type: 'module' | 'lesson' | 'content', id: number, moduleId?: number, lessonId?: number) => {
    setDraggedItem({ type, id, moduleId, lessonId });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetType: 'module' | 'lesson' | 'content', targetId: number, targetModuleId?: number, targetLessonId?: number) => {
    e.preventDefault();
    if (!draggedItem) return;

    if (draggedItem.type === 'module' && targetType === 'module') {
      // Reorder modules
      const modules = [...courseData.modules];
      const draggedIndex = modules.findIndex(m => m.id === draggedItem.id);
      const targetIndex = modules.findIndex(m => m.id === targetId);
      
      if (draggedIndex !== -1 && targetIndex !== -1) {
        const [removed] = modules.splice(draggedIndex, 1);
        modules.splice(targetIndex, 0, removed);
        modules.forEach((m, idx) => { m.order = idx; });
        setCourseData({ ...courseData, modules });
      }
    } else if (draggedItem.type === 'lesson' && targetType === 'lesson' && draggedItem.moduleId === targetModuleId) {
      // Reorder lessons within same module
      const modules = [...courseData.modules];
      const module = modules.find(m => m.id === draggedItem.moduleId);
      if (module) {
        const lessons = [...module.lessons];
        const draggedIndex = lessons.findIndex(l => l.id === draggedItem.id);
        const targetIndex = lessons.findIndex(l => l.id === targetId);
        
        if (draggedIndex !== -1 && targetIndex !== -1) {
          const [removed] = lessons.splice(draggedIndex, 1);
          lessons.splice(targetIndex, 0, removed);
          lessons.forEach((l, idx) => { l.order = idx; });
          module.lessons = lessons;
          setCourseData({ ...courseData, modules });
        }
      }
    } else if (draggedItem.type === 'content' && targetType === 'content' && draggedItem.lessonId === targetLessonId) {
      // Reorder content within same lesson
      const modules = [...courseData.modules];
      const module = modules.find(m => m.id === draggedItem.moduleId);
      if (module) {
        const lesson = module.lessons.find(l => l.id === draggedItem.lessonId);
        if (lesson) {
          const content = [...lesson.content];
          const draggedIndex = content.findIndex(c => c.id === draggedItem.id);
          const targetIndex = content.findIndex(c => c.id === targetId);
          
          if (draggedIndex !== -1 && targetIndex !== -1) {
            const [removed] = content.splice(draggedIndex, 1);
            content.splice(targetIndex, 0, removed);
            content.forEach((c, idx) => { c.order = idx; });
            lesson.content = content;
            setCourseData({ ...courseData, modules });
          }
        }
      }
    }
    
    setDraggedItem(null);
  };

  const handleAddModule = () => {
    const newModule: Module = {
      id: courseData.modules.length,
      title: 'New Module',
      order: courseData.modules.length,
      duration: '0 min',
      lessons: []
    };
    setCourseData({
      ...courseData,
      modules: [...courseData.modules, newModule]
    });
  };

  const handleAddLesson = (moduleId: number) => {
    const modules = [...courseData.modules];
    const module = modules.find(m => m.id === moduleId);
    if (module) {
      const newLesson: Lesson = {
        id: Date.now(),
        title: `Lesson ${module.lessons.length + 1}`,
        order: module.lessons.length,
        duration: '0 min',
        content: []
      };
      module.lessons.push(newLesson);
      setCourseData({ ...courseData, modules });
      setCurrentLesson(module.lessons.length - 1);
    }
  };

  const handleAddContent = (type: ContentType) => {
    if (type === 'video') {
      setContentToReplace(null);
      setSegmentName('');
      setStartTime('');
      setDuration('');
      setUploadType('file');
      setShowUploadModal(true);
    } else if (type === 'quiz') {
      setShowQuizModal(true);
    } else if (type === 'reading') {
      setReadingTitle('');
      setReadingType('url');
      setReadingUrl('');
      setReadingBody('');
      setShowReadingModal(true);
    }
  };

  const handleAddReading = () => {
    const title = readingTitle.trim() || 'Reading';
    const modules = [...courseData.modules];
    const module = modules[currentModule];
    const lesson = module.lessons[currentLesson];
    const newReading: ReadingMaterial = readingType === 'url'
      ? { title, type: 'url', url: readingUrl.trim() || undefined }
      : { title, type: 'native', body: readingBody.trim() || undefined };
    const newContent: ContentItem = {
      id: Date.now(),
      type: 'reading',
      order: lesson.content.length,
      reading: newReading,
    };
    lesson.content.push(newContent);
    setCourseData({ ...courseData, modules });
    setSelectedContent(lesson.content.length - 1);
    setShowReadingModal(false);
    setReadingTitle('');
    setReadingUrl('');
    setReadingBody('');
  };

  const handleContentUpload = () => {
    // Video source URLs (YouTube, Drive, etc.) and timestamps are stored in state and persisted to Supabase on Save (video_segments table). We do not use Supabase Storage for content; use Google Drive / YouTube per project decisions.
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setUploadProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          const modules = [...courseData.modules];
          const module = modules[currentModule];
          const lesson = module.lessons[currentLesson];

          const startSec = parseHHMMSSToSeconds(startTime.trim());
          const endSec = parseHHMMSSToSeconds(duration.trim());
          const defaultStart = 0;
          const defaultEnd = uploadType === 'link' ? 300 : 120; // 5:00 or 2:00
          const startVal = startSec ?? defaultStart;
          const endVal = endSec ?? defaultEnd;

          if (startTime.trim() && startSec === null) return;
          if (duration.trim() && endSec === null) return;
          if (startVal < 0) return;
          if (endVal < startVal) return;
          const maxSec = videoMaxDuration.trim() ? parseHHMMSSToSeconds(videoMaxDuration.trim()) : null;
          if (maxSec != null && endVal > maxSec) return;

          const startStr = formatSecondsToHHMMSS(startVal);
          const endStr = formatSecondsToHHMMSS(endVal);
          const durationStr = formatSecondsToHHMMSS(endVal - startVal);

          let newContent: ContentItem;

          if (uploadType === 'link') {
            const url = unifiedVideoUrl?.trim() || '';
            const linkSource = detectVideoLinkType(url) || 'external_url';
            const linkLabel = linkSource === 'youtube' ? 'YouTube Video' : linkSource === 'google_drive' ? 'Drive Video' : 'Video';
            newContent = {
              id: Date.now(),
              type: 'video',
              order: lesson.content.length,
              videoSegment: {
                id: Date.now(),
                name: segmentName || linkLabel,
                duration: durationStr,
                startTime: startStr,
                endTime: endStr,
                status: 'active',
                size: 'N/A',
                lastEdited: 'Just now',
                source: linkSource,
                sourceUrl: url,
                startTimestamp: startVal,
                endTimestamp: endVal
              }
            };
          } else {
            newContent = {
              id: Date.now(),
              type: 'video',
              order: lesson.content.length,
              videoSegment: {
                id: Date.now(),
                name: segmentName || 'New Segment',
                duration: durationStr,
                startTime: startStr,
                endTime: endStr,
                status: 'active',
                size: '20 MB',
                lastEdited: 'Just now',
                source: 'upload',
                startTimestamp: startVal,
                endTimestamp: endVal
              }
            };
          }
          
          if (contentToReplace) {
            const contentIndex = lesson.content.findIndex(c => c.id === contentToReplace.contentId);
            if (contentIndex !== -1) {
              lesson.content[contentIndex] = { ...newContent, id: contentToReplace.contentId };
            }
          } else {
            lesson.content.push(newContent);
          }
          
          // Update lesson duration (sum of segment lengths: end - start)
          const totalDuration = lesson.content
            .filter(c => c.type === 'video' && c.videoSegment)
            .reduce((acc, c) => {
              const vs = c.videoSegment!;
              if (vs.startTimestamp != null && vs.endTimestamp != null) return acc + (vs.endTimestamp - vs.startTimestamp);
              return acc + parseTimeToSeconds(vs.duration || '0:00');
            }, 0);
          lesson.duration = formatSecondsToTime(totalDuration);
          
          setCourseData({ ...courseData, modules });
          setShowUploadModal(false);
          setUploadProgress(0);
          setSegmentName('');
          setStartTime('');
          setDuration('');
          setVideoMaxDuration('');
          setStartTimeError(null);
          setEndTimeError(null);
          setUnifiedVideoUrl('');
        }, 500);
      }
    }, 200);
  };

  const parseTimeToSeconds = (time: string): number => {
    const t = time.trim();
    const minMatch = t.match(/^(\d+)\s*min$/);
    if (minMatch) return parseInt(minMatch[1], 10) * 60;
    const parsed = parseHHMMSSToSeconds(t);
    if (parsed !== null) return parsed;
    const parts = t.split(':').map(Number);
    if (parts.length === 2) return parts[0] * 60 + (parts[1] ?? 0);
    if (parts.length === 1) return Number.isNaN(parts[0]) ? 0 : (parts[0] ?? 0);
    return 0;
  };

  const formatSecondsToTime = (seconds: number): string => {
    return formatSecondsToHHMMSS(seconds);
  };

  const handleDeleteContent = (lessonId: number, contentId: number) => {
    const modules = [...courseData.modules];
    const module = modules[currentModule];
    const lesson = module.lessons.find(l => l.id === lessonId);
    if (lesson) {
      lesson.content = lesson.content.filter(c => c.id !== contentId);
      lesson.content.forEach((c, idx) => { c.order = idx; });
      
      // Update lesson duration
      const totalDuration = lesson.content
        .filter(c => c.type === 'video' && c.videoSegment)
        .reduce((acc, c) => {
          const vs = c.videoSegment!;
          if (vs.startTimestamp != null && vs.endTimestamp != null) return acc + (vs.endTimestamp - vs.startTimestamp);
          return acc + parseTimeToSeconds(vs.duration || '0:00');
        }, 0);
      lesson.duration = formatSecondsToTime(totalDuration);

      setCourseData({ ...courseData, modules });
      if (selectedContent >= lesson.content.length) {
        setSelectedContent(Math.max(0, lesson.content.length - 1));
      }
    }
  };

  const handleRestoreVersion = (versionId: number) => {
    const updatedVersions = versions.map(v => ({
      ...v,
      isCurrent: v.id === versionId
    }));
    setVersions(updatedVersions);
  };

  const connectGoogleDrive = () => {
    // Google Drive OAuth: Phase 1, Sprint 7-8. For now simulate connection; wire to GOOGLE_CLIENT_ID and redirect when ready.
    setTimeout(() => {
      setDriveConnected(true);
    }, 1000);
  };

  const parseTimeToSecondsForSave = (time: string): number => {
    const parsed = parseHHMMSSToSeconds(time);
    if (parsed !== null) return parsed;
    const parts = time.split(':').map(Number);
    if (parts.length >= 2) return parts[0] * 60 + (parts[1] ?? 0);
    if (parts.length === 1) return parts[0] ?? 0;
    return 0;
  };

  const handleSave = async () => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setCourseData(prev => ({ ...prev, lastEdited: 'Just now' }));
      showSaveMessage('Demo mode: course not persisted. Set NEXT_PUBLIC_SUPABASE_URL in .env.local and sign in to save.');
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        showSaveMessage('Sign in to save courses. Use the "Sign In" button in the sidebar.');
        return;
      }
      // Supabase generated types may omit schema tables
      const db = supabase as any;
      let finalCourseId: string;
      if (savedCourseId) {
        const { error: updateErr } = await db.from('courses').update({
          title: courseData.title,
          description: courseData.description,
          updated_at: new Date().toISOString()
        }).eq('id', savedCourseId);
        if (updateErr) throw updateErr;
        finalCourseId = savedCourseId;
      } else {
        const { data: courseRow, error: courseErr } = await db.from('courses').insert({
          title: courseData.title,
          description: courseData.description,
          status: 'draft',
          created_by: userId
        }).select('id').single();
        if (courseErr) throw courseErr;
        const courseId = (courseRow as { id?: string } | null)?.id;
        if (!courseId) throw new Error('No course id');
        setSavedCourseId(courseId);
        finalCourseId = courseId;
      }
      if (!savedCourseId) {
      for (let mi = 0; mi < courseData.modules.length; mi++) {
        const mod = courseData.modules[mi];
        const { data: modRow, error: modErr } = await db.from('modules').insert({
          course_id: finalCourseId,
          title: mod.title,
          order_index: mod.order
        }).select('id').single();
        if (modErr) throw modErr;
        const moduleId = modRow?.id;
        if (!moduleId) continue;
        for (let li = 0; li < mod.lessons.length; li++) {
          const les = mod.lessons[li];
          const durationSec = parseTimeToSecondsForSave(les.duration) || les.content
            .filter(c => c.type === 'video' && c.videoSegment)
            .reduce((acc, c) => acc + parseTimeToSecondsForSave(c.videoSegment?.duration || '0'), 0);
          const { data: lesRow, error: lesErr } = await db.from('lessons').insert({
            module_id: moduleId,
            title: les.title,
            order_index: les.order,
            duration_seconds: durationSec
          }).select('id').single();
          if (lesErr) throw lesErr;
          const lessonId = lesRow?.id;
          if (!lessonId) continue;
          for (let ci = 0; ci < les.content.length; ci++) {
            const item = les.content[ci];
            const { data: itemRow, error: itemErr } = await db.from('content_items').insert({
              lesson_id: lessonId,
              content_type: item.type,
              order_index: item.order
            }).select('id').single();
            if (itemErr) throw itemErr;
            const contentItemId = itemRow?.id;
            if (!contentItemId) continue;
            if (item.type === 'reading' && item.reading) {
              await (db as any).from('reading_materials').insert({
                content_item_id: contentItemId,
                title: item.reading.title || 'Reading',
                type: item.reading.type,
                url: item.reading.type === 'url' ? (item.reading.url || null) : null,
                body: item.reading.type === 'native' ? (item.reading.body || null) : null
              });
            }
            if (item.type === 'video' && item.videoSegment) {
              const vs = item.videoSegment;
              const startSec = vs.startTimestamp ?? parseTimeToSecondsForSave(vs.startTime || '0:00');
              const endSec = vs.endTimestamp ?? parseTimeToSecondsForSave(vs.endTime || vs.duration || '0:00');
              await db.from('video_segments').insert({
                content_item_id: contentItemId,
                name: vs.name,
                duration_seconds: endSec - startSec || 0,
                start_time_seconds: startSec,
                end_time_seconds: endSec,
                source: vs.source || 'upload',
                source_url: vs.sourceUrl || null
              });
            }
            if (item.type === 'quiz' && item.quiz) {
              await db.from('quizzes').insert({
                content_item_id: contentItemId,
                title: item.quiz.title,
                passing_score: item.quiz.passingScore ?? 70
              });
            }
          }
        }
      }
      }
      setCourseData(prev => ({ ...prev, lastEdited: 'Just now' }));
      showSaveMessage(savedCourseId ? 'Course updated.' : 'Course saved to database.');
    } catch (e: unknown) {
      const err = e as { message?: string; code?: string; details?: string };
      let msg = err?.message || 'Failed to save course.';
      if (typeof err?.details === 'string') msg += ` (${err.details})`;
      if (msg.includes('row-level security') || msg.includes('RLS') || msg.includes('policy')) {
        msg += ' Sign in and ensure your user can create courses.';
      }
      if (msg.toLowerCase().includes('reading_materials') || msg.toLowerCase().includes('does not exist')) {
        msg += ' Run database/ADD_READING_SUPPORT.sql in Supabase if you use reading content.';
      }
      showSaveMessage(msg);
    }
  };

  const handlePublish = async () => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setCourseData(prev => ({ ...prev, status: 'published', lastEdited: 'Just now' }));
      showSaveMessage('Demo: marked as published. Configure Supabase and sign in, then Save, to publish for real.');
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      showSaveMessage('Sign in first, then Save your course, then Publish. Use "Sign In" in the sidebar.');
      return;
    }
    if (savedCourseId) {
      try {
        await (supabase as any).from('courses').update({ status: 'published', updated_at: new Date().toISOString() }).eq('id', savedCourseId);
        setCourseData(prev => ({ ...prev, status: 'published', lastEdited: 'Just now' }));
        showSaveMessage('Course published.');
        return;
      } catch (e: unknown) {
        showSaveMessage(e instanceof Error ? e.message : 'Failed to publish.');
        return;
      }
    }
    setCourseData(prev => ({ ...prev, status: 'published', lastEdited: 'Just now' }));
    showSaveMessage('Save the course first, then click Publish again.');
  };

  return (
    <div className="h-full flex flex-col">
      {saveMessage && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-2 text-sm text-blue-800 flex-shrink-0">
          {saveMessage}
        </div>
      )}
      <div className="flex flex-1 min-h-0">
      {/* Course Structure Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 overflow-auto flex-shrink-0">
        <div className="p-6 border-b border-gray-200">
          <button 
            onClick={() => setCurrentView('courses')} 
            className="flex items-center text-blue-600 hover:text-blue-700 mb-4 transition-all"
          >
            <ChevronRight className="w-5 h-5 rotate-180" />
            <span className="ml-2 font-semibold">Back to Courses</span>
          </button>
          <h3 className="text-lg font-bold mb-2">Course Structure</h3>
          <p className="text-sm text-gray-600">Drag to reorder modules, lessons, and content</p>
        </div>

        <div className="p-6">
          <div className="space-y-3">
            {courseData.modules.map((module, moduleIdx) => (
              <div 
                key={module.id}
                draggable
                onDragStart={(e) => handleDragStart(e, 'module', module.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, 'module', module.id)}
                className={`p-4 rounded-xl border-2 transition-all ${
                  currentModule === moduleIdx 
                    ? 'bg-blue-50 border-blue-500 shadow-md' 
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                } ${draggedItem?.type === 'module' && draggedItem.id === module.id ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center flex-1 min-w-0">
                    <Menu className="w-4 h-4 text-gray-400 mr-2 cursor-move flex-shrink-0" />
                    {editingModuleId === module.id ? (
                      <input
                        type="text"
                        value={module.title}
                        onChange={(e) => {
                          const modules = [...courseData.modules];
                          const m = modules.find(mx => mx.id === module.id);
                          if (m) m.title = e.target.value;
                          setCourseData({ ...courseData, modules });
                        }}
                        onBlur={() => setEditingModuleId(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') setEditingModuleId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold text-sm flex-1 border border-blue-500 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-0"
                        autoFocus
                      />
                    ) : (
                      <p
                        className="font-semibold text-sm flex-1 cursor-pointer truncate"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingModuleId(module.id);
                          setCurrentModule(moduleIdx);
                        }}
                        title="Click to edit module name"
                      >
                        {module.order + 1}. {module.title}
                      </p>
                    )}
                  </div>
                  {currentModule === moduleIdx && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse flex-shrink-0"></div>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                  <span>{module.lessons.length} lessons</span>
                  <span>{module.duration}</span>
                </div>
                
                {/* Lessons within module */}
                {module.lessons.length > 0 && (
                  <div className="mt-3 space-y-2 pl-4 border-l-2 border-gray-200">
                    {module.lessons.map((lesson, lessonIdx) => (
                      <div
                        key={lesson.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, 'lesson', lesson.id, module.id)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, 'lesson', lesson.id, module.id)}
                        onClick={() => {
                          setCurrentModule(moduleIdx);
                          setCurrentLesson(lessonIdx);
                          setSelectedContent(0);
                        }}
                        className={`p-3 rounded-lg border transition-all cursor-pointer ${
                          currentModule === moduleIdx && currentLesson === lessonIdx
                            ? 'bg-blue-100 border-blue-400'
                            : 'bg-gray-50 border-gray-200 hover:border-blue-300'
                        } ${draggedItem?.type === 'lesson' && draggedItem.id === lesson.id ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-center">
                          <Menu className="w-3 h-3 text-gray-400 mr-2 cursor-move" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate">{lesson.order + 1}. {lesson.title}</p>
                            <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                              <span>{lesson.content.length} items</span>
                              <span>{lesson.duration}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <button
                  onClick={() => handleAddLesson(module.id)}
                  className="mt-2 w-full text-xs px-3 py-1.5 border border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Lesson
                </button>
              </div>
            ))}
            
            <button 
              onClick={handleAddModule}
              className="w-full p-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center font-semibold"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Module
            </button>
          </div>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-6 sticky top-0 z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1">
              <input 
                type="text" 
                value={courseData.title}
                onChange={(e) => setCourseData({ ...courseData, title: e.target.value })}
                className="text-3xl font-bold border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 w-full"
              />
              <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                <span>Last edited {courseData.lastEdited}</span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  courseData.status === 'published' 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {courseData.status}
                </span>
              </div>
            </div>
            <div className="flex space-x-3">
              <button 
                onClick={() => setPreviewMode(!previewMode)}
                className="px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 font-semibold flex items-center transition-all"
              >
                <Eye className="w-5 h-5 mr-2" />
                Preview
              </button>
              <button 
                onClick={handleSave}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold flex items-center transition-all shadow-lg"
              >
                <Save className="w-5 h-5 mr-2" />
                Save Changes
              </button>
              <button 
                onClick={handlePublish}
                className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-semibold flex items-center transition-all shadow-lg"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Publish Course
              </button>
            </div>
          </div>
        </div>

        <div className="p-8">
          {currentLessonData ? (
            <>
              {/* Lesson Header */}
              <div className="mb-6">
                <input
                  type="text"
                  value={currentLessonData.title}
                  onChange={(e) => {
                    const modules = [...courseData.modules];
                    modules[currentModule].lessons[currentLesson].title = e.target.value;
                    setCourseData({ ...courseData, modules });
                  }}
                  className="text-2xl font-bold border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2"
                />
                <p className="text-sm text-gray-600 mt-1">{currentLessonData.duration} • {currentLessonData.content.length} content items</p>
              </div>

              {/* Content Items */}
              <div className="space-y-4 mb-6">
                {currentLessonData.content.map((content, idx) => (
                  <div
                    key={content.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, 'content', content.id, currentModule, currentLessonData.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, 'content', content.id, currentModule, currentLessonData.id)}
                    onClick={() => setSelectedContent(idx)}
                    className={`p-6 rounded-xl border-2 transition-all cursor-pointer ${
                      idx === selectedContent
                        ? 'bg-blue-50 border-blue-500 shadow-lg'
                        : 'bg-white border-gray-200 hover:border-blue-300'
                    } ${draggedItem?.type === 'content' && draggedItem.id === content.id ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start flex-1">
                        <Menu className="w-5 h-5 text-gray-400 mr-3 mt-1 cursor-move" />
                        <div className="flex-1">
                          {content.type === 'video' && content.videoSegment && (
                            <>
                              <div className="flex items-center mb-2">
                                <Video className="w-5 h-5 text-blue-600 mr-2" />
                                <span className="font-semibold">{content.videoSegment.name}</span>
                                {content.videoSegment.source === 'youtube' && (
                                  <Youtube className="w-4 h-4 text-red-600 ml-2" />
                                )}
                                {content.videoSegment.source === 'google_drive' && (
                                  <Folder className="w-4 h-4 text-green-600 ml-2" />
                                )}
                                {content.videoSegment.source === 'external_url' && (
                                  <Video className="w-4 h-4 text-violet-600 ml-2" />
                                )}
                                {content.videoSegment.startTimestamp !== undefined && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowStreamSettings(true);
                                    }}
                                    className="ml-2 px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded flex items-center"
                                  >
                                    <Radio className="w-3 h-3 mr-1" />
                                    Streaming
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center space-x-4 text-sm text-gray-600">
                                <span className="flex items-center">
                                  <Clock className="w-4 h-4 mr-1" />
                                  {content.videoSegment.duration}
                                </span>
                                <span className="flex items-center">
                                  <Video className="w-4 h-4 mr-1" />
                                  {content.videoSegment.size}
                                </span>
                                {content.videoSegment.startTimestamp !== undefined && (
                                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                    {formatSecondsToTime(content.videoSegment.startTimestamp)} - {formatSecondsToTime(content.videoSegment.endTimestamp || 0)}
                                  </span>
                                )}
                              </div>
                            </>
                          )}
                          {content.type === 'quiz' && content.quiz && (
                            <>
                              <div className="flex items-center mb-2">
                                <HelpCircle className="w-5 h-5 text-purple-600 mr-2" />
                                <span className="font-semibold">{content.quiz.title}</span>
                              </div>
                              <div className="text-sm text-gray-600">
                                {content.quiz.questions.length} questions • Passing score: {content.quiz.passingScore}%
                              </div>
                            </>
                          )}
                          {content.type === 'reading' && content.reading && (
                            <>
                              <div className="flex items-center mb-2">
                                <BookOpen className="w-5 h-5 text-amber-600 mr-2" />
                                <span className="font-semibold">{content.reading.title}</span>
                                {content.reading.type === 'url' && (
                                  <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded flex items-center">
                                    <Link className="w-3 h-3 mr-1" />
                                    Link
                                  </span>
                                )}
                                {content.reading.type === 'native' && (
                                  <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Native text</span>
                                )}
                              </div>
                              <div className="text-sm text-gray-600">
                                {content.reading.type === 'url' && content.reading.url && (
                                  <a href={content.reading.url} target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:underline truncate block max-w-md">{content.reading.url}</a>
                                )}
                                {content.reading.type === 'native' && (content.reading.body ? `${content.reading.body.slice(0, 80)}${content.reading.body.length > 80 ? '…' : ''}` : 'No content')}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (content.type === 'video') {
                              setContentToReplace({ lessonId: currentLessonData.id, contentId: content.id });
                              setSegmentName(content.videoSegment?.name || '');
                              const seg = content.videoSegment;
                              setStartTime(
                                seg?.startTimestamp != null
                                  ? formatSecondsToHHMMSS(seg.startTimestamp)
                                  : (seg?.startTime || '')
                              );
                              setDuration(
                                seg?.endTimestamp != null
                                  ? formatSecondsToHHMMSS(seg.endTimestamp!)
                                  : (seg?.endTime || seg?.duration || '')
                              );
                              setUploadType(
                                content.videoSegment?.source === 'upload' ? 'file' : 'link'
                              );
                              setUnifiedVideoUrl(
                                content.videoSegment?.source !== 'upload'
                                  ? (content.videoSegment?.sourceUrl || '')
                                  : ''
                              );
                              setShowUploadModal(true);
                            }
                          }}
                          className="p-2 bg-white rounded-lg hover:bg-blue-50 shadow transition-all"
                        >
                          <Edit className="w-4 h-4 text-blue-600" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteContent(currentLessonData.id, content.id);
                          }}
                          className="p-2 bg-white rounded-lg hover:bg-red-50 shadow transition-all"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Content Buttons */}
              <div className="flex space-x-3 mb-6">
                <button
                  onClick={() => handleAddContent('video')}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold flex items-center transition-all shadow-lg"
                >
                  <Video className="w-5 h-5 mr-2" />
                  Add Video
                </button>
                <button
                  onClick={() => handleAddContent('quiz')}
                  className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 font-semibold flex items-center transition-all shadow-lg"
                >
                  <HelpCircle className="w-5 h-5 mr-2" />
                  Add Quiz
                </button>
                <button
                  onClick={() => handleAddContent('form')}
                  className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-semibold flex items-center transition-all shadow-lg"
                >
                  <FileText className="w-5 h-5 mr-2" />
                  Add Form
                </button>
                <button
                  onClick={() => handleAddContent('reading')}
                  className="px-6 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 font-semibold flex items-center transition-all shadow-lg"
                >
                  <BookOpen className="w-5 h-5 mr-2" />
                  Add Reading
                </button>
              </div>

              {/* Video Preview with Streaming Info */}
              {currentContent?.type === 'video' && currentContent.videoSegment && (() => {
                const seg = currentContent.videoSegment;
                const sourceUrl = seg.sourceUrl || '';
                const ytId = seg.source === 'youtube' ? getYouTubeVideoId(sourceUrl) : null;
                const driveId = seg.source === 'google_drive' ? getGoogleDriveFileId(sourceUrl) : null;
                const externalUrl = seg.source === 'external_url' && sourceUrl ? sourceUrl : null;
                const useYtSegmentPlayer = ytId && seg.endTimestamp != null && seg.endTimestamp > 0;
                const embedUrl = ytId && !useYtSegmentPlayer
                  ? getYouTubeEmbedUrl(ytId, seg.startTimestamp ?? undefined, seg.endTimestamp ?? undefined)
                  : driveId
                    ? getGoogleDriveEmbedUrl(driveId, seg.startTimestamp ?? undefined)
                    : externalUrl;
                return (
                <div className="bg-white p-8 rounded-2xl shadow-sm border-2 border-blue-200 mb-6">
                  <div className="rounded-2xl mb-6 aspect-video overflow-hidden shadow-xl relative bg-gray-900">
                    {useYtSegmentPlayer ? (
                      <>
                        <YouTubeSegmentPlayer
                          videoId={ytId}
                          startSeconds={seg.startTimestamp ?? 0}
                          endSeconds={seg.endTimestamp ?? undefined}
                          title={seg.name}
                          className="absolute inset-0 w-full h-full"
                        />
                        <div className="absolute top-2 right-2 bg-purple-600 text-white px-2 py-1 rounded text-xs font-semibold flex items-center">
                          <Radio className="w-3 h-3 mr-1" />
                          Segment: {formatSecondsToTime(seg.startTimestamp ?? 0)} - {formatSecondsToTime(seg.endTimestamp || 0)}
                        </div>
                      </>
                    ) : embedUrl ? (
                      <>
                        {(seg.source === 'google_drive' || seg.source === 'external_url') && seg.endTimestamp != null && seg.endTimestamp > (seg.startTimestamp ?? 0) ? (
                          <SegmentEnforcedIframePlayer
                            embedUrl={embedUrl}
                            startSeconds={seg.startTimestamp ?? 0}
                            endSeconds={seg.endTimestamp ?? undefined}
                            title={seg.name}
                            className="absolute inset-0 w-full h-full"
                          />
                        ) : (
                          <iframe
                            title={seg.name}
                            src={embedUrl}
                            className="absolute inset-0 w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                          />
                        )}
                        {seg.startTimestamp !== undefined && (
                          <div className="absolute top-2 right-2 bg-purple-600 text-white px-2 py-1 rounded text-xs font-semibold flex items-center">
                            <Radio className="w-3 h-3 mr-1" />
                            Segment: {formatSecondsToTime(seg.startTimestamp)} - {formatSecondsToTime(seg.endTimestamp || 0)}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                          <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            className={`w-20 h-20 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-all shadow-2xl relative z-10 ${isPlaying ? 'bg-opacity-90' : 'bg-opacity-100'}`}
                          >
                            {isPlaying ? (
                              <div className="w-8 h-8 flex space-x-1">
                                <div className="w-2 bg-blue-600 rounded" />
                                <div className="w-2 bg-blue-600 rounded" />
                              </div>
                            ) : (
                              <Play className="w-10 h-10 text-blue-600 ml-1" />
                            )}
                          </button>
                          {seg.startTimestamp !== undefined && (
                            <div className="absolute top-4 right-4 bg-purple-600 text-white px-3 py-1 rounded-lg text-sm font-semibold flex items-center">
                              <Radio className="w-4 h-4 mr-2" />
                              Streaming: {formatSecondsToTime(seg.startTimestamp)} - {formatSecondsToTime(seg.endTimestamp || 0)}
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
                            <div className="flex items-center justify-between text-white mb-3">
                              <span className="text-sm font-semibold">{seg.name}</span>
                              <span className="text-sm">{seg.duration}</span>
                            </div>
                            <div className="w-full bg-white/30 rounded-full h-1.5 mb-3 cursor-pointer">
                              <div className="bg-white h-1.5 rounded-full transition-all" style={{ width: '35%' }} />
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-start">
                      <Info className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-blue-900">
                        <p className="font-semibold mb-1">Video Streaming</p>
                        <p>This video will only load and stream the segment between the specified timestamps, reducing bandwidth and improving performance. The video won't be fully downloaded before playback starts.</p>
                      </div>
                    </div>
                  </div>
                </div>
              ); })()}
              {currentContent?.type === 'reading' && currentContent.reading && (
                <div className="bg-white p-8 rounded-2xl shadow-sm border-2 border-amber-200 mb-6">
                  <div className="flex items-center mb-4">
                    <BookOpen className="w-6 h-6 text-amber-600 mr-2" />
                    <h3 className="text-xl font-bold">{currentContent.reading.title}</h3>
                  </div>
                  {currentContent.reading.type === 'url' && currentContent.reading.url ? (
                    <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50" style={{ minHeight: '60vh' }}>
                      <iframe
                        title={currentContent.reading.title}
                        src={currentContent.reading.url.startsWith('http') ? currentContent.reading.url : `https://${currentContent.reading.url}`}
                        className="w-full h-full min-h-[60vh]"
                      />
                      <p className="text-xs text-gray-500 p-2">
                        Link: <a href={currentContent.reading.url} target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:underline">{currentContent.reading.url}</a>
                      </p>
                    </div>
                  ) : currentContent.reading.type === 'native' ? (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 min-h-[200px]">
                      <div className="prose prose-sm max-w-none whitespace-pre-wrap text-gray-800">
                        {currentContent.reading.body || 'No content yet.'}
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500">Add a link or native text.</p>
                  )}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4">
                    <div className="flex items-start">
                      <Info className="w-5 h-5 text-amber-600 mr-3 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-amber-900">
                        <p className="font-semibold mb-1">Reading material</p>
                        <p>Use a link (Google Docs, Microsoft Office, etc.) or write content with the native text editor when adding reading.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <Video className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h4 className="font-bold text-lg mb-2">{courseData.modules.length === 0 ? 'No modules yet' : 'No lesson selected'}</h4>
              <p className="text-sm text-gray-600">
                {courseData.modules.length === 0 ? 'Add your first module in the sidebar to get started.' : 'Select a lesson from the sidebar or create a new one.'}
              </p>
            </div>
          )}

          {/* Version History */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 mt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <RotateCcw className="w-5 h-5 text-gray-600 mr-2" />
                <p className="font-bold text-lg">Version History</p>
              </div>
              <button 
                onClick={() => setShowVersions(!showVersions)}
                className="text-sm text-blue-600 hover:text-blue-700 font-semibold flex items-center"
              >
                {showVersions ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                {showVersions ? 'Hide' : 'Show'} All Versions
              </button>
            </div>

            <div className="space-y-3">
              {versions.length === 0 ? (
                <p className="text-sm text-gray-500 py-2">No version history yet. Save the course to create versions.</p>
              ) : versions.slice(0, showVersions ? versions.length : 2).map((version) => (
                <div 
                  key={version.id}
                  className={`flex items-center justify-between p-4 rounded-xl transition-all ${
                    version.isCurrent 
                      ? 'bg-blue-50 border-2 border-blue-500' 
                      : 'bg-gray-50 border-2 border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-1">
                      <p className="font-semibold">{version.name}</p>
                      {version.isCurrent && (
                        <span className="bg-blue-500 text-white px-2 py-0.5 rounded-full text-xs font-semibold">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{version.changes}</p>
                    <div className="flex items-center space-x-3 text-xs text-gray-500">
                      <span>{version.timestamp}</span>
                      <span>•</span>
                      <span>by {version.author}</span>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    {!version.isCurrent && (
                      <button 
                        onClick={() => handleRestoreVersion(version.id)}
                        className="px-4 py-2 text-blue-600 hover:bg-blue-50 border border-blue-600 rounded-lg font-semibold transition-all"
                      >
                        Restore
                      </button>
                    )}
                    <button className="p-2 hover:bg-gray-100 rounded-lg transition-all">
                      <Download className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                </div>
              )) }
            </div>
          </div>

          {/* Google Drive Integration - commented out for now */}
          {false && (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 mt-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Folder className="w-8 h-8 text-white" />
                </div>
                <div className="ml-4">
                  <h3 className="text-2xl font-bold">Google Drive Integration</h3>
                  <p className="text-sm text-gray-600 mt-1">Store and manage your content externally</p>
                </div>
              </div>
              {!driveConnected ? (
                <button 
                  onClick={connectGoogleDrive}
                  className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-semibold flex items-center transition-all shadow-lg"
                >
                  <Folder className="w-5 h-5 mr-2" />
                  Connect Drive
                </button>
              ) : (
                <div className="flex items-center space-x-3">
                  <div className="flex items-center bg-green-50 px-4 py-2 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                    <span className="text-sm font-semibold text-green-700">Connected</span>
                  </div>
                </div>
              )}
            </div>

            {driveConnected ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="font-semibold">Your Files</p>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center text-sm">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload New
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  {driveFiles.map((file) => (
                    <div 
                      key={file.id}
                      className="border-2 border-gray-200 rounded-xl p-4 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
                    >
                      <div className="w-full aspect-square bg-gray-100 rounded-lg flex items-center justify-center mb-3">
                        {file.type === 'video' ? (
                          <Video className="w-8 h-8 text-gray-600" />
                        ) : (
                          <FileText className="w-8 h-8 text-gray-600" />
                        )}
                      </div>
                      <p className="text-sm font-semibold truncate mb-1">{file.name}</p>
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span>{file.size}</span>
                        <button className="p-1 hover:bg-gray-100 rounded">
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                <Folder className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h4 className="font-bold text-lg mb-2">Connect Your Google Drive</h4>
                <p className="text-sm text-gray-600 mb-4 max-w-md mx-auto">
                  Store your video files in Google Drive to reduce costs and keep your content where you already manage it
                </p>
                <div className="flex items-center justify-center space-x-6 text-sm text-gray-600 mb-6">
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                    <span>No storage fees</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                    <span>Easy migration</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                    <span>Keep control</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          )}
        </div>
      </div>

      {/* Upload Modal with Multiple Options */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-2xl font-bold">
                {contentToReplace ? 'Replace Content' : 'Add New Content'}
              </h3>
              <button 
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadProgress(0);
                  setContentToReplace(null);
                  setSegmentName('');
                  setStartTime('');
                  setDuration('');
                  setVideoMaxDuration('');
                  setStartTimeError(null);
                  setEndTimeError(null);
                  setYoutubeUrl('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {uploadProgress === 0 ? (
                <>
                  {/* Source: Upload file or Video link */}
                  <div className="mb-6">
                    <label className="block text-sm font-semibold mb-3">Select Source</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setUploadType('file')}
                        className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center ${
                          uploadType === 'file'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        <Upload className={`w-8 h-8 mb-2 ${uploadType === 'file' ? 'text-blue-600' : 'text-gray-600'}`} />
                        <span className="text-sm font-semibold">Upload File</span>
                      </button>
                      <button
                        onClick={() => setUploadType('link')}
                        className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center ${
                          uploadType === 'link'
                            ? 'border-violet-500 bg-violet-50'
                            : 'border-gray-200 hover:border-violet-300'
                        }`}
                      >
                        <Video className={`w-8 h-8 mb-2 ${uploadType === 'link' ? 'text-violet-600' : 'text-gray-600'}`} />
                        <span className="text-sm font-semibold">Video Link</span>
                      </button>
                    </div>
                  </div>

                  {uploadType === 'file' && (
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center mb-6 hover:border-blue-500 transition-all cursor-pointer">
                      <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h4 className="font-bold text-lg mb-2">Drop your video here</h4>
                      <p className="text-sm text-gray-600 mb-4">or click to browse</p>
                      <p className="text-xs text-gray-500">Supports MP4, MOV, AVI up to 500MB</p>
                    </div>
                  )}

                  {uploadType === 'link' && (
                    <div className="border-2 border-dashed border-violet-200 rounded-xl p-6 mb-6 bg-violet-50/50">
                      <label className="block text-sm font-semibold mb-2">Paste video link</label>
                      <input
                        type="url"
                        placeholder="YouTube, Google Drive, or any public video URL..."
                        value={unifiedVideoUrl}
                        onChange={(e) => setUnifiedVideoUrl(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white"
                      />
                      {unifiedVideoUrl.trim() && (
                        <p className="text-xs text-gray-600 mt-2">
                          Detected: {detectVideoLinkType(unifiedVideoUrl) === 'youtube'
                            ? 'YouTube'
                            : detectVideoLinkType(unifiedVideoUrl) === 'google_drive'
                              ? 'Google Drive'
                              : 'Video link (public streaming)'}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        Works with YouTube, Google Drive (share as &quot;Anyone with the link can view&quot;), or other public streaming URLs.
                      </p>
                    </div>
                  )}

                  {/* Common Fields */}
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold mb-2">Content Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g., Welcome & Overview"
                        value={segmentName}
                        onChange={(e) => setSegmentName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold mb-2">Start Time</label>
                        <input
                          type="text"
                          placeholder="00:00:00"
                          value={startTime}
                          onChange={(e) => {
                            setStartTime(e.target.value);
                            const v = e.target.value.trim();
                            if (!v) setStartTimeError(null);
                            else {
                              const s = parseHHMMSSToSeconds(v);
                              setStartTimeError(s === null ? 'Use format HH:MM:SS' : s < 0 ? 'Min 00:00:00' : null);
                            }
                          }}
                          onBlur={() => {
                            const s = parseHHMMSSToSeconds(startTime.trim());
                            if (startTime.trim() && s === null) setStartTimeError('Use format HH:MM:SS');
                            else if (s !== null && s < 0) setStartTimeError('Min 00:00:00');
                            else setStartTimeError(null);
                            const e = parseHHMMSSToSeconds(duration.trim());
                            if (duration.trim()) {
                              if (e === null) setEndTimeError('Use format HH:MM:SS');
                              else if (e < (s ?? 0)) setEndTimeError('Must be after start');
                              else if (videoMaxDuration.trim()) {
                                const m = parseHHMMSSToSeconds(videoMaxDuration.trim());
                                if (m != null && e > m) setEndTimeError('Cannot exceed video length');
                                else setEndTimeError(null);
                              } else setEndTimeError(null);
                            } else setEndTimeError(null);
                          }}
                          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${startTimeError ? 'border-red-500' : 'border-gray-300'}`}
                        />
                        <p className="text-xs text-gray-500 mt-1">Format: HH:MM:SS. Min: 00:00:00</p>
                        {startTimeError && <p className="text-xs text-red-600 mt-1">{startTimeError}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-2">End Time</label>
                        <input
                          type="text"
                          placeholder="00:05:00"
                          value={duration}
                          onChange={(e) => {
                            setDuration(e.target.value);
                            const v = e.target.value.trim();
                            if (!v) setEndTimeError(null);
                            else {
                              const eSec = parseHHMMSSToSeconds(v);
                              const sSec = parseHHMMSSToSeconds(startTime.trim());
                              if (eSec === null) setEndTimeError('Use format HH:MM:SS');
                              else if (sSec !== null && eSec < sSec) setEndTimeError('Must be after start');
                              else if (videoMaxDuration.trim()) {
                                const m = parseHHMMSSToSeconds(videoMaxDuration.trim());
                                if (m != null && eSec > m) setEndTimeError('Cannot exceed video length');
                                else setEndTimeError(null);
                              } else setEndTimeError(null);
                            }
                          }}
                          onBlur={() => {
                            const e = parseHHMMSSToSeconds(duration.trim());
                            const s = parseHHMMSSToSeconds(startTime.trim());
                            if (duration.trim() && e === null) setEndTimeError('Use format HH:MM:SS');
                            else if (e !== null && s !== null && e < s) setEndTimeError('Must be after start');
                            else if (e != null && videoMaxDuration.trim()) {
                              const m = parseHHMMSSToSeconds(videoMaxDuration.trim());
                              if (m != null && e > m) setEndTimeError('Cannot exceed video length');
                              else setEndTimeError(null);
                            } else setEndTimeError(null);
                          }}
                          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${endTimeError ? 'border-red-500' : 'border-gray-300'}`}
                        />
                        <p className="text-xs text-gray-500 mt-1">Format: HH:MM:SS. Must be after start; max video length if set below.</p>
                        {endTimeError && <p className="text-xs text-red-600 mt-1">{endTimeError}</p>}
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="block text-sm font-semibold mb-2">Video max duration (optional)</label>
                      <input
                        type="text"
                        placeholder="00:10:00"
                        value={videoMaxDuration}
                        onChange={(e) => {
                          setVideoMaxDuration(e.target.value);
                          if (endTimeError === 'Cannot exceed video length') {
                            const eSec = parseHHMMSSToSeconds(duration.trim());
                            const m = parseHHMMSSToSeconds(e.target.value.trim());
                            if (m != null && eSec != null && eSec > m) setEndTimeError('Cannot exceed video length');
                            else setEndTimeError(null);
                          }
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent max-w-xs"
                      />
                      <p className="text-xs text-gray-500 mt-1">HH:MM:SS. If set, end time cannot exceed this.</p>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                    <div className="flex items-start">
                      <Info className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-blue-900">
                        <p className="font-semibold mb-1">Video Streaming</p>
                        <p>Videos will stream only the specified segment (between start and end times), reducing bandwidth usage. The video won't be fully downloaded before playback starts.</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex space-x-3">
                    <button
                      onClick={() => {
                        setShowUploadModal(false);
                        setContentToReplace(null);
                        setSegmentName('');
                        setStartTime('');
                        setDuration('');
                        setVideoMaxDuration('');
                        setStartTimeError(null);
                        setEndTimeError(null);
                        setYoutubeUrl('');
                      }}
                      className="flex-1 px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 font-semibold transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleContentUpload}
                      disabled={
                        (uploadType === 'link' &&
                          (!unifiedVideoUrl.trim() || !detectVideoLinkType(unifiedVideoUrl.trim()))) ||
                        (() => {
                          const s = parseHHMMSSToSeconds(startTime.trim());
                          const e = parseHHMMSSToSeconds(duration.trim());
                          const defaultStart = 0;
                          const defaultEnd = uploadType === 'link' ? 300 : 120;
                          const startVal = s ?? defaultStart;
                          const endVal = e ?? defaultEnd;
                          if (startTime.trim() && s === null) return true;
                          if (duration.trim() && e === null) return true;
                          if (startVal < 0 || endVal < startVal) return true;
                          const m = videoMaxDuration.trim() ? parseHHMMSSToSeconds(videoMaxDuration.trim()) : null;
                          if (m != null && endVal > m) return true;
                          return false;
                        })()
                      }
                      className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {contentToReplace ? 'Replace Content' : 'Add Content'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-8">
                  <div className="text-center mb-6">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Upload className="w-10 h-10 text-blue-600" />
                    </div>
                    <h4 className="font-bold text-xl mb-2">Processing...</h4>
                    <p className="text-gray-600">Setting up your content</p>
                  </div>

                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-semibold">Progress</span>
                      <span className="font-semibold text-blue-600">{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300"
                        style={{width: `${uploadProgress}%`}}
                      ></div>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center text-gray-600">
                      <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                      <span>Content processed successfully</span>
                    </div>
                    <div className="flex items-center text-gray-600">
                      <div className="w-5 h-5 mr-2">
                        {uploadProgress >= 50 ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        )}
                      </div>
                      <span>Configuring streaming settings...</span>
                    </div>
                    <div className="flex items-center text-gray-400">
                      <div className="w-5 h-5 mr-2">
                        <div className="w-5 h-5 border-2 border-gray-300 rounded-full"></div>
                      </div>
                      <span>Ready for playback</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reading Material Modal */}
      {showReadingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-2xl font-bold">Add Reading Material</h3>
              <button
                onClick={() => { setShowReadingModal(false); setReadingTitle(''); setReadingUrl(''); setReadingBody(''); }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                <div className="flex items-start">
                  <Info className="w-5 h-5 text-amber-600 mr-3 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-amber-900">
                    <p className="font-semibold mb-1">Reading options</p>
                    <p>Link to a Google Doc, Microsoft Office doc, or any public URL, or write content using the native text editor below.</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Title</label>
                  <input
                    type="text"
                    value={readingTitle}
                    onChange={(e) => setReadingTitle(e.target.value)}
                    placeholder="e.g., Chapter 1 – Introduction"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Type</label>
                  <div className="flex gap-4">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="readingType"
                        checked={readingType === 'url'}
                        onChange={() => setReadingType('url')}
                        className="mr-2"
                      />
                      <Link className="w-4 h-4 mr-1 text-amber-600" />
                      Link (Google Doc, Microsoft Doc, etc.)
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="readingType"
                        checked={readingType === 'native'}
                        onChange={() => setReadingType('native')}
                        className="mr-2"
                      />
                      <FileText className="w-4 h-4 mr-1 text-gray-600" />
                      Native text editor
                    </label>
                  </div>
                </div>
                {readingType === 'url' && (
                  <div>
                    <label className="block text-sm font-semibold mb-2">URL</label>
                    <input
                      type="url"
                      value={readingUrl}
                      onChange={(e) => setReadingUrl(e.target.value)}
                      placeholder="https://docs.google.com/... or https://... "
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>
                )}
                {readingType === 'native' && (
                  <div>
                    <label className="block text-sm font-semibold mb-2">Content</label>
                    <textarea
                      value={readingBody}
                      onChange={(e) => setReadingBody(e.target.value)}
                      placeholder="Write or paste your reading content here..."
                      rows={10}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => { setShowReadingModal(false); setReadingTitle(''); setReadingUrl(''); setReadingBody(''); }}
                  className="px-6 py-2 border border-gray-300 rounded-xl hover:bg-gray-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddReading}
                  className="px-6 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 font-semibold"
                >
                  Add Reading
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quiz Modal */}
      {showQuizModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-2xl font-bold">Add Quiz</h3>
              <button 
                onClick={() => { setShowQuizModal(false); setQuizModalTitle(''); setQuizModalPassingScore(70); }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-6">
                <div className="flex items-start">
                  <Info className="w-5 h-5 text-purple-600 mr-3 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-purple-900">
                    <p className="font-semibold mb-1">Quiz Requirement</p>
                    <p>Learners must complete this quiz before they can continue to the next video segment. Set a passing score to control progression.</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Quiz Title</label>
                  <input 
                    type="text" 
                    value={quizModalTitle}
                    onChange={(e) => setQuizModalTitle(e.target.value)}
                    placeholder="e.g., Introduction Quiz"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Passing Score (%)</label>
                  <input 
                    type="number" 
                    value={quizModalPassingScore}
                    onChange={(e) => setQuizModalPassingScore(Number(e.target.value) || 70)}
                    placeholder="70"
                    min={0}
                    max={100}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-3">Add questions in the lesson editor after creating the quiz.</p>
                  <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold text-sm">
                    Add Question
                  </button>
                </div>
              </div>
              <div className="flex space-x-3 mt-6">
                <button 
                  onClick={() => { setShowQuizModal(false); setQuizModalTitle(''); setQuizModalPassingScore(70); }}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 font-semibold transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    const modules = [...courseData.modules];
                    const module = modules[currentModule];
                    const lesson = module.lessons[currentLesson];
                    const newQuiz: ContentItem = {
                      id: Date.now(),
                      type: 'quiz',
                      order: lesson.content.length,
                      quiz: {
                        id: Date.now(),
                        title: quizModalTitle.trim() || 'New Quiz',
                        passingScore: Math.min(100, Math.max(0, Number(quizModalPassingScore) || 70)),
                        questions: []
                      }
                    };
                    lesson.content.push(newQuiz);
                    setCourseData({ ...courseData, modules });
                    setShowQuizModal(false);
                    setQuizModalTitle('');
                    setQuizModalPassingScore(70);
                  }}
                  className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 font-semibold transition-all shadow-lg"
                >
                  Create Quiz
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Mode Modal - uses real course data */}
      {previewMode && (() => {
        const firstVideo = (() => {
          for (const m of courseData.modules) {
            for (const l of m.lessons) {
              const c = l.content.find(x => x.type === 'video' && x.videoSegment?.sourceUrl);
              if (c?.videoSegment) return c.videoSegment;
            }
          }
          return null;
        })();
        const firstLesson = courseData.modules.length > 0 && courseData.modules[0].lessons.length > 0
          ? courseData.modules[0].lessons[0]
          : null;
        const totalLessons = courseData.modules.reduce((acc, m) => acc + m.lessons.length, 0);
        const ytId = firstVideo?.source === 'youtube' && firstVideo?.sourceUrl ? getYouTubeVideoId(firstVideo.sourceUrl) : null;
        const driveId = firstVideo?.source === 'google_drive' && firstVideo?.sourceUrl ? getGoogleDriveFileId(firstVideo.sourceUrl) : null;
        const embedUrl = ytId
          ? getYouTubeEmbedUrl(ytId, firstVideo?.startTimestamp ?? 0, firstVideo?.endTimestamp)
          : driveId
            ? getGoogleDriveEmbedUrl(driveId)
            : firstVideo?.source === 'external_url' && firstVideo?.sourceUrl
              ? firstVideo.sourceUrl
              : null;
        const totalSeconds = courseData.modules.reduce((acc, m) => {
          return acc + m.lessons.reduce((sum, l) => sum + parseTimeToSeconds(l.duration), 0);
        }, 0);
        const totalDurationFormatted = formatSecondsToTime(Number.isFinite(totalSeconds) ? totalSeconds : 0);

        return (
          <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
            <div className="w-full max-w-6xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4 text-white">
                <h3 className="text-2xl font-bold">Course Preview</h3>
                <button 
                  onClick={() => setPreviewMode(false)}
                  className="p-2 hover:bg-white hover:bg-opacity-10 rounded-lg transition-all"
                >
                  <X className="w-8 h-8" />
                </button>
              </div>
              
              <div className="bg-black rounded-2xl overflow-hidden">
                <div className="aspect-video bg-gray-900 flex items-center justify-center overflow-hidden relative">
                  {embedUrl ? (
                    <iframe
                      title="Course preview"
                      src={embedUrl}
                      className="absolute inset-0 w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-400 px-4 text-center">
                      <div className="w-24 h-24 bg-white bg-opacity-10 rounded-full flex items-center justify-center mb-3">
                        <Play className="w-12 h-12 text-white ml-2" />
                      </div>
                      {firstLesson ? (
                        <>
                          <p className="text-sm font-medium text-white/90 mb-1">First lesson: {firstLesson.title || 'Untitled lesson'}</p>
                          <p className="text-sm">Add a video to this lesson to see a preview here.</p>
                        </>
                      ) : (
                        <p className="text-sm">Add a video to the first lesson to see a preview here.</p>
                      )}
                      {courseData.modules.length > 0 && (
                        <p className="text-xs mt-3 text-gray-500">
                          {courseData.modules.length} module{courseData.modules.length !== 1 ? 's' : ''} · {totalLessons} lesson{totalLessons !== 1 ? 's' : ''} · {totalDurationFormatted} total
                        </p>
                      )}
                    </div>
                  )}
                </div>
              
                <div className="p-6 bg-gray-900">
                  <h4 className="text-white font-bold text-lg mb-2">{courseData.title || 'Untitled Course'}</h4>
                  <p className="text-gray-400 text-sm mb-4">{courseData.description || 'No description.'}</p>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-400">
                    <span className="flex items-center">
                      <Video className="w-4 h-4 mr-2" />
                      {courseData.modules.length} modules
                    </span>
                    <span>•</span>
                    <span className="flex items-center">
                      <Clock className="w-4 h-4 mr-2" />
                      {totalDurationFormatted} total
                    </span>
                  </div>

                  {courseData.modules.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-700">
                      <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">Course outline</p>
                      <ul className="space-y-2">
                        {courseData.modules.map((mod, idx) => {
                          const modDuration = mod.lessons.reduce((s, l) => s + parseTimeToSeconds(l.duration), 0);
                          return (
                            <li key={mod.id} className="text-gray-400 text-sm">
                              <span className="text-white font-medium">Module {idx + 1}:</span> {mod.title || 'Untitled module'}
                              {' '}
                              <span className="text-gray-500">
                                ({mod.lessons.length} lesson{mod.lessons.length !== 1 ? 's' : ''}
                                {modDuration > 0 && ` · ${formatSecondsToTime(modDuration)}`})
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      </div>
    </div>
  );
};

export default CreateCourse;
