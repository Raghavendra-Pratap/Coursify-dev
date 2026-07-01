'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Pause, Plus, Clock, Video, ChevronRight, Edit, X, Save, Zap, Folder, Upload, Eye, RotateCcw,
  Trash2, CheckCircle, Info, ChevronDown, ChevronUp, Download, Copy, FileText, Menu,
  Youtube, HelpCircle, Radio, AlertCircle, BookOpen, Link, FileSpreadsheet, Award, LayoutList
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { invalidateClientCache } from '@/lib/client-fetch-cache';
import { ReadingContentRenderer } from '@/components/ReadingContentRenderer';
import { AssessmentGradingPanel } from '@/components/AssessmentGradingPanel';
import { AddAssessmentPanel } from '@/components/AddAssessmentPanel';
import { AssessmentPreviewEmbed } from '@/components/AssessmentPreviewEmbed';
import { YouTubeImportPanel } from '@/components/YouTubeImportPanel';
import { SheetImportPanel } from '@/components/SheetImportPanel';
import { CourseStructurePanel } from '@/components/CourseStructurePanel';
import type { YouTubeImportModule } from '@/lib/youtube-import';
import { moveContentItem, moveLesson, type StructureModule } from '@/lib/course-structure';

interface CreateCourseProps {
  setCurrentView: (view: string) => void;
  initialCourseId?: string | null;
  onBackToCourses?: () => void;
  /** When course is created from sheet import, open it in the editor (parent sets editingCourseId and stays on create view). */
  onImportSuccess?: (courseId: string) => void;
  /** Called after a successful save so the shell can track the real course id (URL + My Courses). */
  onCourseSaved?: (courseId: string) => void;
  /** Expose import / organize actions to the app shell top nav while editing. */
  onRegisterEditorActions?: (actions: {
    openImportYouTube: () => void;
    openImportSheet: () => void;
    openOrganize: () => void;
  }) => void;
}

const courseEditorPillBtn =
  'flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors';

// Updated data structure: Lessons contain content items (video segments, quizzes, forms, reading)
type ContentType = 'video' | 'quiz' | 'form' | 'reading' | 'assessment';
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
  /** Google Form URL; when set, quiz is rendered as embedded form in TakeCourse */
  formUrl?: string;
  /** Google Form hidden field entry ID for webhook; when set, token is pre-filled so form submit can POST score to our webhook */
  formEntryIdWebhook?: string;
}

interface FormContent {
  id: number;
  title: string;
  /** Google Form URL; rendered as embedded form in TakeCourse */
  formUrl?: string;
}

interface ExternalAssessmentContent {
  title: string;
  description?: string;
  assessmentProId: string;
  accessMode: 'lms_embed' | 'proctored_portal';
  passingScore: number;
}

// Reading material: link (Google Doc, Microsoft Doc, etc.) or native in-app text (plain, markdown, or html)
interface ReadingMaterial {
  title: string;
  type: 'url' | 'native';
  url?: string;
  body?: string;
  format?: 'plain' | 'markdown' | 'html';
}

interface ContentItem {
  id: number;
  type: ContentType;
  order: number;
  videoSegment?: VideoSegment;
  quiz?: Quiz;
  form?: FormContent;
  reading?: ReadingMaterial;
  assessment?: ExternalAssessmentContent;
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

function createDefaultModules(): Module[] {
  const baseId = Date.now();
  return [
    {
      id: baseId,
      title: 'New Module',
      order: 0,
      duration: '0 min',
      lessons: [
        {
          id: baseId + 1,
          title: 'Lesson 1',
          order: 0,
          duration: '0 min',
          content: [],
        },
      ],
    },
  ];
}

function createNewCourseBoilerplate(overrides?: { title?: string; description?: string; status?: 'draft' | 'published' }) {
  return {
    title: overrides?.title ?? 'Untitled Course',
    description: overrides?.description ?? '',
    lastEdited: 'Just now',
    status: overrides?.status ?? ('draft' as const),
    modules: createDefaultModules(),
  };
}

function isEmptyCourseBoilerplate(modules: Module[]): boolean {
  if (modules.length === 0) return true;
  const totalContent = modules.reduce(
    (count, mod) => count + mod.lessons.reduce((lessonCount, lesson) => lessonCount + lesson.content.length, 0),
    0
  );
  return totalContent === 0;
}

function renumberCourseStructure(modules: Module[]): Module[] {
  return modules.map((mod, modIdx) => ({
    ...mod,
    order: modIdx,
    lessons: mod.lessons.map((lesson, lessonIdx) => ({
      ...lesson,
      order: lessonIdx,
      content: lesson.content.map((item, contentIdx) => ({ ...item, order: contentIdx })),
    })),
  }));
}

/** Normalize course snapshot for change detection (order-independent; ignore ids and volatile fields like lastEdited). Only creates a new version when content actually changed. */
function normalizeSnapshotForCompare(snapshot: { title?: string; description?: string; modules?: Array<{ title?: string; order?: number; lessons?: Array<{ title?: string; order?: number; duration?: string; content?: Array<Record<string, unknown>> }> }> } | null): string {
  if (!snapshot || typeof snapshot !== 'object') return '';
  const stripVolatile = (obj: Record<string, unknown>): Record<string, unknown> => {
    const { id: _id, lastEdited: _le, ...rest } = obj;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v && typeof v === 'object' && !Array.isArray(v) && k === 'videoSegment') {
        const { lastEdited: _vle, ...vRest } = v as Record<string, unknown>;
        out[k] = vRest;
      } else if (Array.isArray(v)) {
        out[k] = v.map((item) => (item && typeof item === 'object' ? stripVolatile(item as Record<string, unknown>) : item));
      } else out[k] = v;
    }
    return out;
  };
  const mods = (snapshot.modules || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const normalized = {
    title: snapshot.title ?? '',
    description: snapshot.description ?? '',
    modules: mods.map((m) => {
      const lessons = (m.lessons || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      return {
        title: m.title ?? '',
        order: m.order ?? 0,
        lessons: lessons.map((l) => {
          const content = (l.content || []).slice().sort((a, b) => ((a as { order?: number }).order ?? 0) - ((b as { order?: number }).order ?? 0));
          return {
            title: l.title ?? '',
            order: l.order ?? 0,
            duration: l.duration ?? '',
            content: content.map((c) => stripVolatile(c as Record<string, unknown>)),
          };
        }),
      };
    }),
  };
  return JSON.stringify(normalized);
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
  if (startSeconds != null && startSeconds >= 0) params.set('start', String(Math.floor(startSeconds)));
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

/** True if the URL is a known non-video link (e.g. Google Doc, Sheet, Form). Use to warn in video link section. */
function isNonVideoLink(url: string): boolean {
  const u = (url?.trim() || '').toLowerCase();
  if (!u) return false;
  if (/docs\.google\.com\/document\//.test(u)) return true;
  if (/docs\.google\.com\/spreadsheets\//.test(u)) return true;
  if (/docs\.google\.com\/forms\//.test(u)) return true;
  if (/docs\.google\.com\/presentation\//.test(u)) return true;
  if (/drive\.google\.com\/drive\//.test(u)) return true; // folder
  if (/drive\.google\.com\/folders\//.test(u)) return true;
  return false;
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

/**
 * Normalize external video URLs for iframe usage.
 * For SharePoint/OneDrive, force web/embed mode and keep start hint when possible.
 */
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

/** Proxy URL for Google Drive so we can play in <video> and read currentTime in Add New Content modal */
function getDriveProxyVideoUrl(fileId: string): string {
  const driveDirect = `https://drive.google.com/uc?export=download&id=${fileId}`;
  return `/api/proxy-video?url=${encodeURIComponent(driveDirect)}`;
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

/** Convert document URLs to embed-friendly format (Google Docs /preview, etc.) — same as TakeCourse. */
function getReadingEmbedUrl(url: string): string {
  const u = url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`;
  const gdocMatch = u.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)(?:\/edit|\/view)?/);
  if (gdocMatch) return `https://docs.google.com/document/d/${gdocMatch[1]}/preview`;
  const gsheetMatch = u.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (gsheetMatch) return `https://docs.google.com/spreadsheets/d/${gsheetMatch[1]}/htmlembed`;
  if (/\.(docx?|xlsx?|pptx?)(\?|$)/i.test(u) || u.includes('office.com') || u.includes('onedrive')) {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(u)}`;
  }
  return u;
}

/** Google Form embed URL (viewform?embedded=true) for quiz/form in combined viewer. */
function getFormEmbedUrl(url: string): string {
  const u = url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`;
  const m = u.match(/docs\.google\.com\/forms\/d\/(?:e\/)?([a-zA-Z0-9_-]+)(?:\/.*)?/);
  if (m) {
    const id = m[1];
    const base = id.length > 20 ? `https://docs.google.com/forms/d/e/${id}/viewform` : `https://docs.google.com/forms/d/${id}/viewform`;
    return base.includes('?') ? `${base}&embedded=true` : `${base}?embedded=true`;
  }
  return u;
}

/** Format seconds as HH:MM:SS (e.g. 90 → "00:01:30"). */
function formatSecondsToHHMMSS(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map(n => n.toString().padStart(2, '0')).join(':');
}

/** Buffer (seconds) before showing "Segment ended" so Drive/iframe playback isn't cut off by load delay */
const SEGMENT_END_BUFFER_SECONDS = 3;

/**
 * Iframe player that enforces segment end for sources we can't control (Google Drive, external).
 * After (endSeconds - startSeconds) + buffer, hides the iframe and shows "Segment ended" + Replay.
 * Drive embed URL should already include start time (?t=). Buffer ensures we don't cut off the last few seconds.
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
  const segmentDuration = endSeconds != null && endSeconds > startSeconds ? endSeconds - startSeconds : 0;
  const durationSeconds = segmentDuration + SEGMENT_END_BUFFER_SECONDS;

  useEffect(() => {
    if (segmentDuration <= 0 || segmentEnded) return;
    const t = setTimeout(() => setSegmentEnded(true), durationSeconds * 1000);
    return () => clearTimeout(t);
  }, [segmentDuration, durationSeconds, segmentEnded, replayKey]);

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
          className="px-4 py-2 bg-blue-600 text-white rounded-lg"
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

/** YouTube embed for segment preview. Uses iframe with start/end params only (no IFrame API) to avoid postMessage origin errors on localhost. */
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
  const embedUrl = getYouTubeEmbedUrl(videoId, startSeconds, endSeconds);
  return (
    <iframe
      key={`${videoId}-${startSeconds ?? 0}-${endSeconds ?? 'full'}`}
      title={title ?? 'YouTube segment'}
      src={embedUrl}
      className={className}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
    />
  );
}

const CreateCourse: React.FC<CreateCourseProps> = ({ setCurrentView, initialCourseId, onBackToCourses, onImportSuccess, onCourseSaved, onRegisterEditorActions }) => {
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
  /** Combined (learner-style) preview: step-by-step with synced or simulated progress. */
  const [lessonPreviewMode, setLessonPreviewMode] = useState<'segment' | 'combined'>('combined');
  const [previewPopupContent, setPreviewPopupContent] = useState<ContentItem | null>(null);
  const [combinedSegmentIndex, setCombinedSegmentIndex] = useState(0);
  const [combinedPlaybackSeconds, setCombinedPlaybackSeconds] = useState(0);
  const [combinedPlaying, setCombinedPlaying] = useState(false);
  const [combinedYtPlayerReady, setCombinedYtPlayerReady] = useState(false);
  const combinedYtPlayerRef = useRef<{ getCurrentTime?: () => number; playVideo?: () => void; pauseVideo?: () => void; destroy?: () => void } | null>(null);
  const [combinedDrivePlayerReady, setCombinedDrivePlayerReady] = useState(false);
  const combinedDriveVideoRef = useRef<HTMLVideoElement | null>(null);
  const [segmentName, setSegmentName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState('');
  const [videoMaxDuration, setVideoMaxDuration] = useState(''); // Optional HH:MM:SS for validation
  const [showYouTubeImport, setShowYouTubeImport] = useState(false);
  const [showSheetImport, setShowSheetImport] = useState(false);
  const [showStructurePanel, setShowStructurePanel] = useState(false);

  useEffect(() => {
    onRegisterEditorActions?.({
      openImportYouTube: () => setShowYouTubeImport(true),
      openImportSheet: () => setShowSheetImport(true),
      openOrganize: () => setShowStructurePanel(true),
    });
  }, [onRegisterEditorActions]);
  const [startTimeError, setStartTimeError] = useState<string | null>(null);
  const [endTimeError, setEndTimeError] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [draggedItem, setDraggedItem] = useState<{type: 'module' | 'lesson' | 'content', id: number, moduleId?: number, lessonId?: number} | null>(null);
  const [showGoogleFormModal, setShowGoogleFormModal] = useState(false);
  const [googleFormKind, setGoogleFormKind] = useState<'quiz' | 'form'>('form');
  const [quizModalTitle, setQuizModalTitle] = useState('');
  const [quizModalPassingScore, setQuizModalPassingScore] = useState(70);
  const [quizModalFormUrl, setQuizModalFormUrl] = useState('');
  const [quizModalFormEntryIdWebhook, setQuizModalFormEntryIdWebhook] = useState('');
  const [quizModalScriptCopied, setQuizModalScriptCopied] = useState(false);
  const [quizModalRecordScoresOpen, setQuizModalRecordScoresOpen] = useState(false);

  const resetGoogleFormModal = () => {
    setShowGoogleFormModal(false);
    setGoogleFormKind('form');
    setQuizModalTitle('');
    setQuizModalFormUrl('');
    setQuizModalPassingScore(70);
    setQuizModalFormEntryIdWebhook('');
    setQuizModalScriptCopied(false);
    setQuizModalRecordScoresOpen(false);
  };

  const openGoogleFormModal = (kind: 'quiz' | 'form' = 'form') => {
    setGoogleFormKind(kind);
    setQuizModalTitle('');
    setQuizModalFormUrl('');
    setQuizModalPassingScore(70);
    setQuizModalFormEntryIdWebhook('');
    setQuizModalScriptCopied(false);
    setQuizModalRecordScoresOpen(false);
    setShowGoogleFormModal(true);
  };

  /** Build Apps Script code with custom webhook URL. Entry ID can be empty (placeholder used). */
  const getQuizWebhookScript = (entryId: string, passingScore: number) => {
    const baseUrl = typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL || 'https://YOUR-COURSIFY-APP');
    const webhookUrl = `${baseUrl.replace(/\/$/, '')}/api/webhooks/google-form-quiz`;
    const safeEntryId = entryId.trim()
      ? String(entryId).trim().replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      : 'YOUR_ENTRY_ID';
    return `const WEBHOOK_URL = '${webhookUrl}';
const PASSING_SCORE = ${Math.min(100, Math.max(0, Number(passingScore) || 70))};

function onFormSubmit(e) {
  if (!e || !e.response) return;
  var itemResponses = e.response.getItemResponses();
  var entryId = "${safeEntryId}";
  var token = null;

  for (var i = 0; i < itemResponses.length; i++) {
    var r = itemResponses[i];
    var id = String(r.getItem().getId());
    if (id === entryId) {
      token = r.getResponse();
      break;
    }
  }

  if (!token) return;

  var totalScore = 0;
  var maxScore = 0;
  var form = FormApp.getActiveForm();
  var items = form.getItems();
  for (var j = 0; j < items.length; j++) {
    var item = items[j];
    var gr = e.response.getGradableResponseForItem(item);
    if (gr) {
      totalScore += gr.getScore();
      try { maxScore += item.asQuizItem().getPoints(); } catch (err) {}
    }
  }
  var score = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  var passed = score >= PASSING_SCORE;

  var payload = JSON.stringify({
    token: token,
    score: Math.round(Number(score)),
    passed: !!passed
  });

  UrlFetchApp.fetch(WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: payload,
    muteHttpExceptions: true
  });
}
`;
  };
  const [showAssessmentPanel, setShowAssessmentPanel] = useState(false);
  const [assessmentAddSession, setAssessmentAddSession] = useState(0);
  const [editingAssessmentContentId, setEditingAssessmentContentId] = useState<number | null>(null);
  const [showStreamSettings, setShowStreamSettings] = useState(false);
  const [savedCourseId, setSavedCourseId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [editingModuleId, setEditingModuleId] = useState<number | null>(null);
  const [collapsedSidebarModules, setCollapsedSidebarModules] = useState<Set<number>>(new Set());
  const [showReadingModal, setShowReadingModal] = useState(false);
  const [readingTitle, setReadingTitle] = useState('');
  const [readingType, setReadingType] = useState<'url' | 'native'>('url');
  const [readingUrl, setReadingUrl] = useState('');
  const [readingBody, setReadingBody] = useState('');
  const [readingFormat, setReadingFormat] = useState<'plain' | 'markdown' | 'html'>('plain');
  const linkPreviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const drivePreviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const ytPreviewPlayerRef = useRef<{ getCurrentTime?: () => number; getDuration?: () => number } | null>(null);
  const [ytPreviewReady, setYtPreviewReady] = useState(false);
  const [externalPreviewReady, setExternalPreviewReady] = useState(false);
  const [drivePreviewReady, setDrivePreviewReady] = useState(false);
  const [drivePreviewCurrentTime, setDrivePreviewCurrentTime] = useState('0:00:00');
  const [drivePreviewError, setDrivePreviewError] = useState(false);

  // Reset external preview ready when URL changes or modal closes
  useEffect(() => {
    if (!showUploadModal || uploadType !== 'link' || detectVideoLinkType(unifiedVideoUrl?.trim() || '') !== 'external_url') {
      setExternalPreviewReady(false);
    }
  }, [showUploadModal, uploadType, unifiedVideoUrl]);

  // Reset Drive preview when URL/modal changes or when Drive file ID changes (retry proxy for new file)
  const driveFileId = unifiedVideoUrl?.trim() ? getGoogleDriveFileId(unifiedVideoUrl) : null;
  useEffect(() => {
    if (!showUploadModal || uploadType !== 'link' || detectVideoLinkType(unifiedVideoUrl?.trim() || '') !== 'google_drive') {
      setDrivePreviewReady(false);
      setDrivePreviewCurrentTime('0:00:00');
      setDrivePreviewError(false);
      return;
    }
    setDrivePreviewReady(false);
    setDrivePreviewCurrentTime('0:00:00');
    setDrivePreviewError(false);
  }, [showUploadModal, uploadType, unifiedVideoUrl, driveFileId]);

  // Sync "Current position" from Drive proxy video in Add New Content modal
  useEffect(() => {
    if (detectVideoLinkType(unifiedVideoUrl?.trim() || '') !== 'google_drive' || !drivePreviewReady) return;
    const el = drivePreviewVideoRef.current;
    if (!el) return;
    const update = () => {
      const t = el.currentTime;
      if (Number.isFinite(t) && t >= 0) setDrivePreviewCurrentTime(formatSecondsToHHMMSS(t));
    };
    el.addEventListener('timeupdate', update);
    const intervalId = setInterval(update, 200);
    update();
    return () => {
      el.removeEventListener('timeupdate', update);
      clearInterval(intervalId);
    };
  }, [unifiedVideoUrl, drivePreviewReady]);

  // YouTube preview player in Add Content modal when creator pastes a link
  useEffect(() => {
    if (!showUploadModal || uploadType !== 'link') {
      setYtPreviewReady(false);
      const p = ytPreviewPlayerRef.current as { destroy?: () => void } | null;
      if (p?.destroy) {
        try { p.destroy(); } catch { /* ignore */ }
      }
      ytPreviewPlayerRef.current = null;
      return;
    }
    const url = unifiedVideoUrl?.trim() || '';
    const videoId = detectVideoLinkType(url) === 'youtube' ? getYouTubeVideoId(url) : null;
    if (!videoId) return;

    setYtPreviewReady(false);
    const containerId = 'create-course-yt-preview';

    const initYouTube = () => {
      const YT = (typeof window !== 'undefined' ? (window as unknown as { YT?: { Player: new (el: string, opts: unknown) => { getCurrentTime?: () => number; destroy?: () => void } } }).YT : undefined);
      if (!YT?.Player) return;
      const el = document.getElementById(containerId);
      if (!el) return;
      const player = new YT.Player(containerId, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          start: 0,
          rel: 0,
          modestbranding: 1,
          controls: 1,
          autoplay: 0,
        },
        events: {
          onReady: () => {
            ytPreviewPlayerRef.current = player as unknown as { getCurrentTime?: () => number; getDuration?: () => number };
            setYtPreviewReady(true);
          },
        },
      });
      ytPreviewPlayerRef.current = player as unknown as { getCurrentTime?: () => number; getDuration?: () => number };
    };

    if (typeof window !== 'undefined' && (window as unknown as { YT?: { Player: unknown } }).YT?.Player) {
      initYouTube();
      return () => {
        const p = ytPreviewPlayerRef.current as { destroy?: () => void } | null;
        if (p?.destroy) try { p.destroy(); } catch { /* ignore */ }
        ytPreviewPlayerRef.current = null;
        setYtPreviewReady(false);
      };
    }
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    const win = typeof window !== 'undefined' ? (window as unknown as { onYouTubeIframeAPIReady?: () => void }) : undefined;
    const prev = win?.onYouTubeIframeAPIReady;
    if (win) {
      win.onYouTubeIframeAPIReady = () => {
        prev?.();
        initYouTube();
      };
    }
    document.head.appendChild(script);
    return () => {
      const p = ytPreviewPlayerRef.current as { destroy?: () => void } | null;
      if (p?.destroy) try { p.destroy(); } catch { /* ignore */ }
      ytPreviewPlayerRef.current = null;
      setYtPreviewReady(false);
    };
  }, [showUploadModal, uploadType, unifiedVideoUrl]);

  const handleYouTubeImportApply = (modules: YouTubeImportModule[], courseTitle?: string) => {
    setCourseData((prev) => {
      const replaceBoiler = prev.modules.length === 0 || isEmptyCourseBoilerplate(prev.modules);
      const base = Date.now();
      const normalized = modules.map((m, mi) => ({
        ...m,
        id: replaceBoiler && mi === 0 ? m.id : base + mi,
        order: replaceBoiler ? mi : prev.modules.length + mi,
        lessons: m.lessons.map((l, li) => ({
          ...l,
          id: base + mi * 1000 + li + 1,
          order: li,
          content: l.content.map((c, ci) => ({
            ...c,
            id: base + mi * 1000 + li * 100 + ci + 1,
            order: ci,
            videoSegment: c.videoSegment
              ? { ...c.videoSegment, id: base + mi * 1000 + li * 100 + ci + 1 }
              : c.videoSegment,
          })),
        })),
      }));
      return {
        ...prev,
        title: courseTitle && prev.title === 'Untitled Course' ? courseTitle : prev.title,
        modules: renumberCourseStructure(replaceBoiler ? normalized : [...prev.modules, ...normalized]),
        lastEdited: 'Just now',
      };
    });
    setCurrentModule(0);
    setCurrentLesson(0);
    setSelectedContent(0);
    setCombinedSegmentIndex(0);
    showSaveMessage('YouTube content added to your course. Click Save Changes to persist.');
  };

  const handleStructureChange = (modules: StructureModule[]) => {
    setCourseData((prev) => ({ ...prev, modules: modules as Module[], lastEdited: 'Just now' }));
    setCurrentModule((idx) => Math.min(idx, Math.max(0, modules.length - 1)));
    setCurrentLesson((idx) => {
      const modIdx = Math.min(currentModule, Math.max(0, modules.length - 1));
      const mod = modules[modIdx];
      return Math.min(idx, Math.max(0, (mod?.lessons.length ?? 1) - 1));
    });
  };

  const handleStructureNavigate = (moduleIndex: number, lessonIndex: number, contentIndex?: number) => {
    setCurrentModule(moduleIndex);
    setCurrentLesson(lessonIndex);
    if (contentIndex != null) {
      setSelectedContent(contentIndex);
      setCombinedSegmentIndex(contentIndex);
    }
    setShowStructurePanel(false);
  };

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
  }>(createNewCourseBoilerplate());

  // Version history (loaded from course_versions when savedCourseId is set)
  const [versions, setVersions] = useState<{ id: string; name: string; changes: string; timestamp: string; isCurrent: boolean; author: string }[]>([]);

  // Drive files (populated when Google Drive is connected)
  const [driveFiles, setDriveFiles] = useState<{ id: number; name: string; size: string; type: string; modified: string }[]>([]);
  const driveUploadInputRef = useRef<HTMLInputElement>(null);

  // Edit load state: when opening a course by initialCourseId
  const [courseLoadState, setCourseLoadState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const restoredDraftKeyRef = useRef<string | null>(null);

  const getDraftStorageKey = useCallback(() => {
    const keyId = initialCourseId || savedCourseId || 'new';
    return `create_course_draft_${keyId}`;
  }, [initialCourseId, savedCourseId]);

  // Restore unsaved editor draft (prevents data loss on remount/tab restore/sidebar transitions).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const draftKey = getDraftStorageKey();
    if (restoredDraftKeyRef.current === draftKey) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        courseData?: { title: string; description: string; lastEdited: string; status: 'draft' | 'published'; modules: Module[] };
        currentModule?: number;
        currentLesson?: number;
        selectedContent?: number;
        combinedSegmentIndex?: number;
        editingAssessmentContentId?: number | null;
        savedCourseId?: string | null;
      };
      if (parsed?.courseData?.modules && Array.isArray(parsed.courseData.modules)) {
        const isEditingExistingCourse = !!initialCourseId;
        const draftMatchesCourse = parsed.savedCourseId === initialCourseId;
        const hasAnyStructure = parsed.courseData.modules.length > 0;

        // For existing courses, avoid restoring empty/stale drafts that hide real DB structure.
        if (isEditingExistingCourse && (!draftMatchesCourse || !hasAnyStructure)) {
          return;
        }

        // "Create New Course" must not restore empty drafts — start with default module + lesson.
        if (!initialCourseId && parsed.courseData.modules.length === 0) {
          return;
        }

        // "Create New Course" must not restore a draft tied to a saved course id.
        if (!initialCourseId && parsed.savedCourseId) {
          return;
        }

        setCourseData({
          ...parsed.courseData,
          // Status comes from the database after publish — never trust local draft for invites/My Courses.
          status: 'draft',
        });
        setCurrentModule(typeof parsed.currentModule === 'number' ? parsed.currentModule : 0);
        setCurrentLesson(typeof parsed.currentLesson === 'number' ? parsed.currentLesson : 0);
        setSelectedContent(typeof parsed.selectedContent === 'number' ? parsed.selectedContent : 0);
        setCombinedSegmentIndex(typeof parsed.combinedSegmentIndex === 'number' ? parsed.combinedSegmentIndex : (typeof parsed.selectedContent === 'number' ? parsed.selectedContent : 0));
        if (typeof parsed.editingAssessmentContentId === 'number') {
          setEditingAssessmentContentId(parsed.editingAssessmentContentId);
        }
        if (typeof parsed.savedCourseId === 'string' && parsed.savedCourseId) setSavedCourseId(parsed.savedCourseId);
        setCourseLoadState('loaded');
        restoredDraftKeyRef.current = draftKey;
      }
    } catch {
      // ignore invalid local draft
    }
  }, [getDraftStorageKey, initialCourseId]);

  // Persist unsaved editor draft frequently to avoid losing work.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const payload = JSON.stringify({
        courseData: {
          title: courseData.title,
          description: courseData.description,
          lastEdited: courseData.lastEdited,
          modules: courseData.modules,
        },
        currentModule,
        currentLesson,
        selectedContent,
        combinedSegmentIndex,
        editingAssessmentContentId,
        savedCourseId,
        updatedAt: Date.now(),
      });
      localStorage.setItem(getDraftStorageKey(), payload);
    } catch {
      // ignore storage errors
    }
  }, [courseData.title, courseData.description, courseData.lastEdited, courseData.modules, currentModule, currentLesson, selectedContent, combinedSegmentIndex, editingAssessmentContentId, savedCourseId, getDraftStorageKey]);

  // Keep editor status in sync with the database (draft restore must not show "published" falsely).
  useEffect(() => {
    const courseId = initialCourseId || savedCourseId;
    if (!courseId || !process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/instructor/courses/${encodeURIComponent(courseId)}`, {
          credentials: 'include',
          cache: 'no-store',
        });
        const data = (await res.json().catch(() => ({}))) as { status?: string; error?: string };
        if (cancelled || !res.ok || !data.status) return;
        const dbStatus = data.status as 'draft' | 'published' | 'archived';
        if (dbStatus === 'draft' || dbStatus === 'published') {
          setCourseData((prev) => (prev.status === dbStatus ? prev : { ...prev, status: dbStatus }));
        }
      } catch {
        // ignore — editor still usable from local draft
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialCourseId, savedCourseId]);

  // Load existing course when editing from My Courses
  useEffect(() => {
    const draftKey = getDraftStorageKey();
    if (restoredDraftKeyRef.current === draftKey) return;
    if (!initialCourseId || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setCourseLoadState('idle');
      return;
    }
    setCourseLoadState('loading');
    const db = supabase as any;
    (async () => {
      try {
        const { data: courseRow, error: courseErr } = await db.from('courses').select('id, title, description, status').eq('id', initialCourseId).maybeSingle();
        if (courseErr || !courseRow) {
          setCourseLoadState('error');
          return;
        }
        setSavedCourseId((courseRow as { id: string }).id);
        const c = courseRow as { title: string; description: string | null; status: string };
        const { data: modRows } = await db.from('modules').select('id, title, order_index').eq('course_id', initialCourseId).order('order_index');
        const modules: Module[] = [];
        if (!modRows?.length) {
          setCourseData(
            createNewCourseBoilerplate({
              title: c.title,
              description: c.description || '',
              status: (c.status as 'draft' | 'published') || 'draft',
            })
          );
          setCourseLoadState('loaded');
          return;
        }
        for (let mi = 0; mi < modRows.length; mi++) {
          const mod = modRows[mi] as { id: string; title: string; order_index: number };
          const { data: lessonRows } = await db.from('lessons').select('id, title, order_index, duration_seconds').eq('module_id', mod.id).order('order_index');
          const lessons: Lesson[] = [];
          for (let li = 0; li < (lessonRows || []).length; li++) {
            const les = (lessonRows as { id: string; title: string; order_index: number; duration_seconds: number | null }[])[li];
            const dur = les.duration_seconds != null ? formatSecondsToHHMMSS(les.duration_seconds) : '0:00';
            const { data: itemRows } = await db.from('content_items').select('id, content_type, order_index').eq('lesson_id', les.id).order('order_index');
            const content: ContentItem[] = [];
            for (let ci = 0; ci < (itemRows || []).length; ci++) {
              const item = (itemRows as { id: string; content_type: string; order_index: number }[])[ci];
              const type = (item.content_type === 'video' || item.content_type === 'quiz' || item.content_type === 'form' || item.content_type === 'reading' || item.content_type === 'assessment') ? item.content_type : 'reading';
              const contentItem: ContentItem = { id: ci, type: type as ContentType, order: item.order_index };
              if (type === 'video') {
                const { data: vsRows } = await db.from('video_segments').select('name, duration_seconds, start_time_seconds, end_time_seconds, source, source_url').eq('content_item_id', item.id).order('id');
                const vs = vsRows?.[0] as { name: string; duration_seconds: number; start_time_seconds: number; end_time_seconds: number; source: string; source_url: string | null } | undefined;
                contentItem.videoSegment = vs ? { id: ci, name: vs.name, duration: formatSecondsToHHMMSS(vs.duration_seconds || 0), startTime: formatSecondsToHHMMSS(vs.start_time_seconds || 0), endTime: formatSecondsToHHMMSS(vs.end_time_seconds || 0), startTimestamp: vs.start_time_seconds ?? 0, endTimestamp: vs.end_time_seconds, status: 'active', size: '', lastEdited: '', source: (vs.source as VideoSource) || 'upload', sourceUrl: vs.source_url || undefined } : undefined;
              }
              if (type === 'reading') {
                const { data: rmRows } = await db.from('reading_materials').select('title, type, url, body, format').eq('content_item_id', item.id).maybeSingle();
                const rm = rmRows as { title: string; type: string; url: string | null; body: string | null; format?: string | null } | undefined;
                contentItem.reading = rm ? { title: rm.title, type: (rm.type as 'url' | 'native'), url: rm.url || undefined, body: rm.body || undefined, format: (rm.format as 'plain' | 'markdown' | 'html') || 'plain' } : undefined;
              }
              if (type === 'quiz') {
                const { data: qRows } = await db.from('quizzes').select('title, passing_score, form_url, form_entry_id_webhook').eq('content_item_id', item.id).maybeSingle();
                const q = qRows as { title: string; passing_score: number; form_url?: string | null; form_entry_id_webhook?: string | null } | undefined;
                contentItem.quiz = q ? { id: ci, title: q.title, questions: [], passingScore: q.passing_score ?? 70, formUrl: q.form_url || undefined, formEntryIdWebhook: q.form_entry_id_webhook || undefined } : undefined;
              }
              if (type === 'form') {
                const { data: formRows } = await db.from('forms').select('title, form_url').eq('content_item_id', item.id).maybeSingle();
                const f = formRows as { title: string; form_url?: string | null } | undefined;
                contentItem.form = f ? { id: ci, title: f.title, formUrl: f.form_url || undefined } : undefined;
              }
              if (type === 'assessment') {
                const { data: extRows } = await db.from('external_assessments').select('title, description, assessment_pro_assessment_id, access_mode, passing_score').eq('content_item_id', item.id).maybeSingle();
                const ext = extRows as { title: string | null; description: string | null; assessment_pro_assessment_id: string; access_mode: 'lms_embed' | 'proctored_portal'; passing_score: number | null } | undefined;
                contentItem.assessment = ext ? {
                  title: ext.title ?? 'Assessment',
                  description: ext.description ?? undefined,
                  assessmentProId: ext.assessment_pro_assessment_id,
                  accessMode: ext.access_mode,
                  passingScore: ext.passing_score ?? 70,
                } : undefined;
              }
              content.push(contentItem);
            }
            lessons.push({ id: li, title: les.title, order: les.order_index, content, duration: dur });
          }
          modules.push({ id: mi, title: mod.title, order: mod.order_index, lessons, duration: '0:00' });
        }
        setCourseData({ title: c.title, description: c.description || '', lastEdited: 'Just now', status: (c.status as 'draft' | 'published') || 'draft', modules });
        setCourseLoadState('loaded');
        try {
          const { data: versionRows } = await db.from('course_versions').select('id, version_number, changes_description, created_at, is_current').eq('course_id', initialCourseId).order('version_number', { ascending: false });
          if (versionRows?.length) {
            setVersions((versionRows as { id: string; version_number: number; changes_description: string | null; created_at: string; is_current: boolean }[]).map(v => ({
              id: v.id,
              name: `Version ${v.version_number}`,
              changes: v.changes_description || 'No description',
              timestamp: new Date(v.created_at).toLocaleString(),
              isCurrent: !!v.is_current,
              author: 'Author'
            })));
          } else setVersions([]);
        } catch {
          setVersions([]);
        }
      } catch {
        setCourseLoadState('error');
      }
    })();
  }, [initialCourseId, getDraftStorageKey]);

  const toggleSidebarModule = (moduleId: number) => {
    setCollapsedSidebarModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  useEffect(() => {
    const activeModule = courseData.modules[currentModule];
    if (!activeModule) return;
    setCollapsedSidebarModules((prev) => {
      if (!prev.has(activeModule.id)) return prev;
      const next = new Set(prev);
      next.delete(activeModule.id);
      return next;
    });
  }, [currentModule, courseData.modules]);

  const currentModuleData = courseData.modules[currentModule];
  const currentLessonData = currentModuleData?.lessons[currentLesson];
  const currentContent = currentLessonData?.content?.[selectedContent];
  const editingAssessmentContent =
    editingAssessmentContentId != null
      ? currentLessonData?.content.find((c) => c.id === editingAssessmentContentId)
      : null;

  // Combined lesson preview: simulated playback position (we can't read iframe currentTime for YT/Drive)
  const [combinedPreviewElapsedSeconds, setCombinedPreviewElapsedSeconds] = useState(0);
  const segIdentity = currentContent?.type === 'video' && currentContent.videoSegment
    ? `${currentModule}-${currentLesson}-${selectedContent}-${currentContent.videoSegment.startTimestamp ?? 0}-${currentContent.videoSegment.endTimestamp ?? 0}`
    : '';
  useEffect(() => {
    setCombinedPreviewElapsedSeconds(0);
  }, [segIdentity]);

  const combinedSegmentDuration = (() => {
    if (currentContent?.type !== 'video' || !currentContent.videoSegment) return 0;
    const seg = currentContent.videoSegment;
    const start = seg.startTimestamp ?? (seg.startTime ? parseHHMMSSToSeconds(seg.startTime) ?? 0 : 0);
    const end = seg.endTimestamp ?? (seg.endTime ? parseHHMMSSToSeconds(seg.endTime) : seg.duration ? parseHHMMSSToSeconds(seg.duration) : null);
    if (end == null || !Number.isFinite(start) || end <= start) return 0;
    return Math.max(0, end - start);
  })();
  const hasCombinedPlayer = (() => {
    if (currentContent?.type !== 'video' || !currentContent.videoSegment) return false;
    const seg = currentContent.videoSegment;
    const sourceUrl = seg.sourceUrl || '';
    const ytId = seg.source === 'youtube' ? getYouTubeVideoId(sourceUrl) : null;
    const driveId = seg.source === 'google_drive' ? getGoogleDriveFileId(sourceUrl) : null;
    const externalUrl = seg.source === 'external_url' && sourceUrl ? sourceUrl : null;
    const useYt = ytId && seg.endTimestamp != null && seg.endTimestamp > 0;
    const embedUrl = ytId && !useYt
      ? getYouTubeEmbedUrl(ytId, seg.startTimestamp ?? undefined, seg.endTimestamp ?? undefined)
      : driveId
        ? getGoogleDriveEmbedUrl(driveId, seg.startTimestamp ?? undefined)
        : externalUrl;
    return useYt || !!embedUrl;
  })();
  useEffect(() => {
    if (!hasCombinedPlayer || combinedSegmentDuration <= 0) return;
    const id = setInterval(() => {
      setCombinedPreviewElapsedSeconds((prev) => {
        const next = Math.min(prev + 0.25, combinedSegmentDuration);
        return next;
      });
    }, 250);
    return () => clearInterval(id);
  }, [segIdentity, hasCombinedPlayer, combinedSegmentDuration]);

  /** Duration of a video segment in seconds (for combined preview). */
  const getSegmentDurationSeconds = (vs: VideoSegment): number => {
    if (vs.startTimestamp != null && vs.endTimestamp != null && vs.endTimestamp > vs.startTimestamp)
      return vs.endTimestamp - vs.startTimestamp;
    return parseTimeToSeconds(vs.duration || '0:00');
  };

  // Combined (learner) view: all content in order (video, reading, quiz, form) like TakeCourse
  const allStepsForLesson = currentLessonData?.content ?? [];
  const totalSteps = allStepsForLesson.length;
  const totalStepsCombined = totalSteps;
  const currentStepContent = allStepsForLesson[combinedSegmentIndex] ?? null;
  const isCurrentStepVideo = currentStepContent?.type === 'video' && currentStepContent?.videoSegment;
  const currentSegmentInCombined = isCurrentStepVideo ? (currentStepContent as ContentItem & { type: 'video'; videoSegment: VideoSegment }) : null;
  const videoSegmentsForLesson = allStepsForLesson.filter((c): c is ContentItem & { type: 'video'; videoSegment: VideoSegment } => c.type === 'video' && !!c.videoSegment);
  const totalCombinedSeconds = videoSegmentsForLesson.reduce((acc, c) => acc + getSegmentDurationSeconds(c.videoSegment!), 0);
  const currentSegmentDurationSec = currentSegmentInCombined ? getSegmentDurationSeconds(currentSegmentInCombined.videoSegment!) : 0;
  const accumulatedDurationBeforeCurrent = videoSegmentsForLesson.filter((_, i) => allStepsForLesson.indexOf(videoSegmentsForLesson[i]) < combinedSegmentIndex).reduce((acc, c) => acc + getSegmentDurationSeconds(c.videoSegment!), 0);
  const progressInCurrentStep = isCurrentStepVideo && currentSegmentDurationSec > 0 ? Math.min(1, combinedPlaybackSeconds / currentSegmentDurationSec) : 0;
  const combinedProgressPct = totalSteps > 0 ? ((combinedSegmentIndex + progressInCurrentStep) / totalSteps) * 100 : 0;

  useEffect(() => {
    setCombinedSegmentIndex(0);
    setCombinedPlaybackSeconds(0);
    setCombinedPlaying(false);
    setCombinedYtPlayerReady(false);
    combinedYtPlayerRef.current = null;
  }, [currentModule, currentLesson]);

  const segForCombined = lessonPreviewMode === 'combined' ? currentSegmentInCombined?.videoSegment : null;
  const ytIdCombined = segForCombined?.source === 'youtube' && segForCombined?.sourceUrl ? getYouTubeVideoId(segForCombined.sourceUrl) : null;
  const driveIdCombined = segForCombined?.source === 'google_drive' && segForCombined?.sourceUrl ? getGoogleDriveFileId(segForCombined.sourceUrl) : null;
  const ytStartCombined = (() => {
    if (!segForCombined) return 0;
    if (segForCombined.startTimestamp != null) return segForCombined.startTimestamp;
    if (segForCombined.startTime) {
      const fromHms = parseHHMMSSToSeconds(segForCombined.startTime);
      if (fromHms != null) return fromHms;
    }
    return 0;
  })();
  const ytEndCombined = (() => {
    if (!segForCombined) return 0;
    if (segForCombined.endTimestamp != null) return segForCombined.endTimestamp;
    if (segForCombined.endTime) {
      const fromHms = parseHHMMSSToSeconds(segForCombined.endTime);
      if (fromHms != null) return fromHms;
    }
    return 0;
  })();

  useEffect(() => {
    if (!driveIdCombined) setCombinedDrivePlayerReady(false);
  }, [driveIdCombined, combinedSegmentIndex]);

  useEffect(() => {
    setCombinedPlaybackSeconds(0);
  }, [combinedSegmentIndex]);

  // YouTube IFrame API for combined preview: single persistent container, cueVideoById on segment change, never destroy
  const COMBINED_YT_CONTAINER_ID = 'create-course-combined-yt';
  useEffect(() => {
    if (lessonPreviewMode !== 'combined') {
      setCombinedYtPlayerReady(false);
      combinedYtPlayerRef.current = null;
      return;
    }
    if (!ytIdCombined || !currentSegmentInCombined) {
      setCombinedYtPlayerReady(false);
      return;
    }
    const containerId = COMBINED_YT_CONTAINER_ID;
    type YtPlayer = { getCurrentTime?: () => number; playVideo?: () => void; pauseVideo?: () => void; cueVideoById?: (opts: { videoId: string; startSeconds: number; endSeconds?: number }) => void };

    const initOrUpdateYt = () => {
      const YT = (typeof window !== 'undefined' ? (window as unknown as { YT?: { Player: new (el: string, opts: unknown) => YtPlayer } }).YT : undefined);
      if (!YT?.Player) return;
      const el = document.getElementById(containerId);
      if (!el) return;
      const existing = combinedYtPlayerRef.current as YtPlayer | null;
      const containerStillMounted = typeof document !== 'undefined' && document.body.contains(el);
      if (existing?.cueVideoById && containerStillMounted) {
        existing.cueVideoById({
          videoId: ytIdCombined,
          startSeconds: Math.floor(ytStartCombined),
          endSeconds: ytEndCombined > ytStartCombined ? Math.floor(ytEndCombined) : undefined,
        });
        setCombinedYtPlayerReady(true);
        return;
      }
      if (!containerStillMounted) combinedYtPlayerRef.current = null;
      setCombinedYtPlayerReady(false);
      const player = new YT.Player(containerId, {
        videoId: ytIdCombined,
        width: '100%',
        height: '100%',
        playerVars: {
          start: Math.floor(ytStartCombined),
          end: ytEndCombined > ytStartCombined ? Math.floor(ytEndCombined) : undefined,
          rel: 0,
          modestbranding: 1,
          controls: 1,
          autoplay: 0,
        },
        events: {
          onReady: () => {
            combinedYtPlayerRef.current = player as unknown as YtPlayer;
            setCombinedYtPlayerReady(true);
          },
        },
      });
      combinedYtPlayerRef.current = player as unknown as YtPlayer;
    };

    if (typeof window !== 'undefined' && (window as unknown as { YT?: { Player: unknown } }).YT?.Player) {
      initOrUpdateYt();
      return () => {
        setCombinedYtPlayerReady(false);
        // Never destroy: same window switches YT/Drive by visibility; container stays mounted
      };
    }
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    const win = typeof window !== 'undefined' ? (window as unknown as { onYouTubeIframeAPIReady?: () => void }) : undefined;
    const prev = win?.onYouTubeIframeAPIReady;
    if (win) {
      win.onYouTubeIframeAPIReady = () => { prev?.(); initOrUpdateYt(); };
    }
    document.head.appendChild(script);
    return () => {
      setCombinedYtPlayerReady(false);
    };
  }, [lessonPreviewMode, combinedSegmentIndex, ytIdCombined, ytStartCombined, ytEndCombined, currentSegmentInCombined]);

  // Sync combined progress from Drive proxy video
  useEffect(() => {
    if (lessonPreviewMode !== 'combined' || !combinedDrivePlayerReady || !currentSegmentInCombined?.videoSegment || !driveIdCombined) return;
    const seg = currentSegmentInCombined.videoSegment;
    const startSec = seg.startTimestamp ?? 0;
    const endSec = seg.endTimestamp ?? startSec;
    const segmentDuration = endSec > startSec ? endSec - startSec : 0;
    let mounted = true;
    const POLL_MS = 100;
    const intervalId = setInterval(() => {
      if (!mounted) return;
      const el = combinedDriveVideoRef.current;
      if (!el || !Number.isFinite(el.currentTime)) return;
      const t = el.currentTime;
      const timeInSegment = Math.max(0, t - startSec);
      setCombinedPlaybackSeconds(Math.min(timeInSegment, segmentDuration));
      if (segmentDuration > 0 && timeInSegment >= segmentDuration - 0.3) {
        const steps = (currentLessonData?.content?.length ?? 0);
        if (combinedSegmentIndex < steps - 1) {
          setCombinedSegmentIndex((i) => i + 1);
          setCombinedPlaybackSeconds(0);
          el.pause();
        } else {
          setCombinedPlaying(false);
        }
      }
    }, POLL_MS);
    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [lessonPreviewMode, combinedDrivePlayerReady, combinedSegmentIndex, currentSegmentInCombined, driveIdCombined, currentLessonData?.content?.length]);

  // Sync combined progress from YouTube player
  useEffect(() => {
    if (lessonPreviewMode !== 'combined' || !combinedYtPlayerReady || !currentSegmentInCombined?.videoSegment) return;
    const seg = currentSegmentInCombined.videoSegment;
    const startSec = seg.startTimestamp ?? 0;
    const endSec = seg.endTimestamp ?? startSec;
    const segmentDuration = endSec > startSec ? endSec - startSec : 0;
    let mounted = true;
    const POLL_MS = 100;
    const intervalId = setInterval(() => {
      if (!mounted) return;
      const player = combinedYtPlayerRef.current;
      const t = player?.getCurrentTime?.();
      if (typeof t !== 'number' || t < 0) return;
      const timeInSegment = Math.max(0, t - startSec);
      setCombinedPlaybackSeconds(Math.min(timeInSegment, segmentDuration));
      if (segmentDuration > 0 && timeInSegment >= segmentDuration - 0.3) {
        const steps = (currentLessonData?.content?.length ?? 0);
        if (combinedSegmentIndex < steps - 1) {
          setCombinedSegmentIndex((i) => i + 1);
          setCombinedPlaybackSeconds(0);
          player?.pauseVideo?.();
        } else {
          setCombinedPlaying(false);
        }
      }
    }, POLL_MS);
    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [lessonPreviewMode, combinedYtPlayerReady, combinedSegmentIndex, currentSegmentInCombined, currentLessonData?.content?.length]);

  // Simulated timer when we don't have synced source (YouTube or Drive proxy)
  useEffect(() => {
    if (lessonPreviewMode !== 'combined' || !combinedPlaying || totalCombinedSeconds <= 0 || combinedYtPlayerReady || combinedDrivePlayerReady) return;
    const interval = setInterval(() => {
      setCombinedPlaybackSeconds((prev) => {
        const next = prev + 0.1;
        if (next >= currentSegmentDurationSec) {
          if (combinedSegmentIndex < totalSteps - 1) {
            setCombinedSegmentIndex((i) => i + 1);
            return 0;
          }
          setCombinedPlaying(false);
          return currentSegmentDurationSec;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [lessonPreviewMode, combinedPlaying, combinedSegmentIndex, currentSegmentDurationSec, totalSteps, totalCombinedSeconds, combinedYtPlayerReady, combinedDrivePlayerReady]);

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, type: 'module' | 'lesson' | 'content', id: number, moduleId?: number, lessonId?: number) => {
    setDraggedItem({ type, id, moduleId, lessonId });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `${type}-${id}`);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
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
    } else if (draggedItem.type === 'lesson' && targetType === 'lesson') {
      const fromModuleIdx = courseData.modules.findIndex((m) => m.id === draggedItem.moduleId);
      const toModuleIdx = courseData.modules.findIndex((m) => m.id === targetModuleId);
      if (fromModuleIdx === -1 || toModuleIdx === -1) {
        setDraggedItem(null);
        return;
      }
      const fromLessonIdx = courseData.modules[fromModuleIdx].lessons.findIndex((l) => l.id === draggedItem.id);
      const toLessonIdx = courseData.modules[toModuleIdx].lessons.findIndex((l) => l.id === targetId);
      if (fromLessonIdx === -1 || toLessonIdx === -1) {
        setDraggedItem(null);
        return;
      }
      if (fromModuleIdx === toModuleIdx && fromLessonIdx !== toLessonIdx) {
        const modules = [...courseData.modules];
        const moduleItem = modules[fromModuleIdx];
        const lessons = [...moduleItem.lessons];
        const [removed] = lessons.splice(fromLessonIdx, 1);
        lessons.splice(toLessonIdx, 0, removed);
        lessons.forEach((l, idx) => { l.order = idx; });
        moduleItem.lessons = lessons;
        setCourseData({ ...courseData, modules });
      } else if (fromModuleIdx !== toModuleIdx) {
        setCourseData((prev) => ({
          ...prev,
          modules: moveLesson(prev.modules, { moduleIndex: fromModuleIdx, lessonIndex: fromLessonIdx }, toModuleIdx, toLessonIdx) as Module[],
          lastEdited: 'Just now',
        }));
      }
    } else if (draggedItem.type === 'content' && targetType === 'lesson' && targetModuleId != null && targetLessonId != null) {
      const fromModuleIdx = courseData.modules.findIndex((m) => m.id === draggedItem.moduleId);
      const toModuleIdx = courseData.modules.findIndex((m) => m.id === targetModuleId);
      if (fromModuleIdx === -1 || toModuleIdx === -1) {
        setDraggedItem(null);
        return;
      }
      const fromLessonIdx = courseData.modules[fromModuleIdx].lessons.findIndex((l) => l.id === draggedItem.lessonId);
      const toLessonIdx = courseData.modules[toModuleIdx].lessons.findIndex((l) => l.id === targetLessonId);
      const fromContentIdx = courseData.modules[fromModuleIdx]?.lessons[fromLessonIdx]?.content.findIndex((c) => c.id === draggedItem.id) ?? -1;
      if (fromLessonIdx === -1 || toLessonIdx === -1 || fromContentIdx === -1) {
        setDraggedItem(null);
        return;
      }
      if (fromModuleIdx !== toModuleIdx || fromLessonIdx !== toLessonIdx) {
        setCourseData((prev) => ({
          ...prev,
          modules: moveContentItem(
            prev.modules,
            { moduleIndex: fromModuleIdx, lessonIndex: fromLessonIdx, contentIndex: fromContentIdx },
            { moduleIndex: toModuleIdx, lessonIndex: toLessonIdx }
          ) as Module[],
          lastEdited: 'Just now',
        }));
      }
    } else if (draggedItem.type === 'content' && targetType === 'content' && draggedItem.lessonId === targetLessonId) {
      // Reorder content within same lesson (immutable update so UI and save see new order)
      const draggedIndex = courseData.modules
        .find(m => m.id === draggedItem.moduleId)
        ?.lessons.find(l => l.id === draggedItem.lessonId)
        ?.content.findIndex(c => c.id === draggedItem.id) ?? -1;
      const targetIndex = courseData.modules
        .find(m => m.id === targetModuleId)
        ?.lessons.find(l => l.id === targetLessonId)
        ?.content.findIndex(c => c.id === targetId) ?? -1;
      if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
        const modules = courseData.modules.map(m => {
          if (m.id !== draggedItem.moduleId) return m;
          return {
            ...m,
            lessons: m.lessons.map(l => {
              if (l.id !== draggedItem.lessonId) return l;
              const content = [...l.content];
              const [removed] = content.splice(draggedIndex, 1);
              content.splice(targetIndex, 0, removed);
              content.forEach((c, idx) => { c.order = idx; });
              return { ...l, content };
            })
          };
        });
        setCourseData({ ...courseData, modules });
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
    const moduleItem = modules.find(m => m.id === moduleId);
    if (moduleItem) {
      const newLesson: Lesson = {
        id: Date.now(),
        title: `Lesson ${moduleItem.lessons.length + 1}`,
        order: moduleItem.lessons.length,
        duration: '0 min',
        content: []
      };
      moduleItem.lessons.push(newLesson);
      setCourseData({ ...courseData, modules });
      setCurrentLesson(moduleItem.lessons.length - 1);
    }
  };

  const handleAddContent = (type: ContentType) => {
    if (type === 'video') {
      setContentToReplace(null);
      setSegmentName('');
      setStartTime('');
      setDuration('');
      setUploadType('link');
      setShowUploadModal(true);
    } else if (type === 'reading') {
      setReadingTitle('');
      setReadingType('url');
      setReadingUrl('');
      setReadingBody('');
      setShowReadingModal(true);
    } else if (type === 'assessment') {
      setEditingAssessmentContentId(null);
      if (showAssessmentPanel) {
        setShowAssessmentPanel(false);
      } else {
        setAssessmentAddSession((n) => n + 1);
        setShowAssessmentPanel(true);
      }
    }
  };

  const handleStartEditAssessment = (content: ContentItem, contentIndex: number) => {
    setSelectedContent(contentIndex);
    setCombinedSegmentIndex(contentIndex);
    setShowAssessmentPanel(false);
    setEditingAssessmentContentId(content.id);
  };

  const handleCloseAssessmentEdit = () => {
    setEditingAssessmentContentId(null);
  };

  const handleUpdateAssessmentContent = (assessment: {
    title: string;
    description?: string;
    assessmentProId: string;
    accessMode: 'lms_embed' | 'proctored_portal';
    passingScore: number;
  }) => {
    if (editingAssessmentContentId == null) return;
    const modules = [...courseData.modules];
    const moduleItem = modules[currentModule];
    const lesson = moduleItem.lessons[currentLesson];
    const idx = lesson.content.findIndex((c) => c.id === editingAssessmentContentId);
    if (idx < 0) return;
    lesson.content[idx] = {
      ...lesson.content[idx],
      assessment: {
        title: assessment.title,
        description: assessment.description,
        assessmentProId: assessment.assessmentProId,
        accessMode: assessment.accessMode,
        passingScore: assessment.passingScore,
      },
    };
    setCourseData({ ...courseData, modules });
    setEditingAssessmentContentId(null);
  };

  const handleAddAssessmentContent = (assessment: {
    title: string;
    description?: string;
    assessmentProId: string;
    accessMode: 'lms_embed' | 'proctored_portal';
    passingScore: number;
  }) => {
    const modules = [...courseData.modules];
    const moduleItem = modules[currentModule];
    const lesson = moduleItem.lessons[currentLesson];
    const newAssessment: ContentItem = {
      id: Date.now(),
      type: 'assessment',
      order: lesson.content.length,
      assessment: {
        title: assessment.title,
        description: assessment.description,
        assessmentProId: assessment.assessmentProId,
        accessMode: assessment.accessMode,
        passingScore: assessment.passingScore,
      },
    };
    lesson.content.push(newAssessment);
    setCourseData({ ...courseData, modules });
    setSelectedContent(lesson.content.length - 1);
  };

  const handleAddReading = () => {
    const title = readingTitle.trim() || 'Reading';
    const modules = [...courseData.modules];
    const moduleItem = modules[currentModule];
    const lesson = moduleItem.lessons[currentLesson];
    const newReading: ReadingMaterial = readingType === 'url'
      ? { title, type: 'url', url: readingUrl.trim() || undefined }
      : { title, type: 'native', body: readingBody.trim() || undefined, format: readingFormat };
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
    setReadingFormat('plain');
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
          const moduleItem = modules[currentModule];
          const lesson = moduleItem.lessons[currentLesson];

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
    if (editingAssessmentContentId === contentId) {
      setEditingAssessmentContentId(null);
      setShowAssessmentPanel(false);
    }

    const moduleItem = courseData.modules[currentModule];
    const lesson = moduleItem?.lessons.find((l) => l.id === lessonId);
    const newContentLen = lesson ? lesson.content.filter((c) => c.id !== contentId).length : 0;

    setCourseData((prev) => {
      const modules = prev.modules.map((mod, mi) => {
        if (mi !== currentModule) return mod;
        return {
          ...mod,
          lessons: mod.lessons.map((les) => {
            if (les.id !== lessonId) return les;
            const content = les.content.filter((c) => c.id !== contentId);
            content.forEach((c, idx) => {
              c.order = idx;
            });
            const totalDuration = content
              .filter((c) => c.type === 'video' && c.videoSegment)
              .reduce((acc, c) => {
                const vs = c.videoSegment!;
                if (vs.startTimestamp != null && vs.endTimestamp != null) return acc + (vs.endTimestamp - vs.startTimestamp);
                return acc + parseTimeToSeconds(vs.duration || '0:00');
              }, 0);
            return {
              ...les,
              content,
              duration: formatSecondsToTime(totalDuration),
            };
          }),
        };
      });
      return { ...prev, modules };
    });

    if (selectedContent >= newContentLen) {
      setSelectedContent(Math.max(0, newContentLen - 1));
    }
    if (combinedSegmentIndex >= newContentLen) {
      setCombinedSegmentIndex(Math.max(0, newContentLen - 1));
    }
  };

  const handleDeleteModule = (moduleId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const modules = renumberCourseStructure(courseData.modules.filter((m) => m.id !== moduleId));
    const newIdx = Math.min(currentModule, Math.max(0, modules.length - 1));
    setCurrentModule(newIdx);
    setCurrentLesson(0);
    setSelectedContent(0);
    setCourseData({ ...courseData, modules });
  };

  const handleDeleteLesson = (moduleIdx: number, lessonId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const modules = [...courseData.modules];
    const mod = modules[moduleIdx];
    if (!mod) return;
    const lessons = mod.lessons.filter((l) => l.id !== lessonId);
    modules[moduleIdx] = { ...mod, lessons };
    const renumbered = renumberCourseStructure(modules);
    const newLessonIdx = currentModule === moduleIdx ? Math.min(currentLesson, Math.max(0, lessons.length - 1)) : currentLesson;
    if (currentModule === moduleIdx) setCurrentLesson(newLessonIdx);
    setSelectedContent(0);
    setCourseData({ ...courseData, modules: renumbered });
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!savedCourseId) return;
    const db = supabase as any;
    const { data: ver } = await db.from('course_versions').select('course_snapshot').eq('id', versionId).maybeSingle();
    const snapshot = (ver as { course_snapshot?: unknown } | null)?.course_snapshot;
    if (snapshot && typeof snapshot === 'object' && snapshot !== null && 'modules' in snapshot) {
      setCourseData(prev => ({ ...prev, ...(snapshot as { title?: string; description?: string; modules: Module[] }) }));
    }
    await db.from('course_versions').update({ is_current: false }).eq('course_id', savedCourseId);
    await db.from('course_versions').update({ is_current: true }).eq('id', versionId);
    setVersions(prev => prev.map(v => ({ ...v, isCurrent: v.id === versionId })));
  };

  const handleDownloadVersion = async (versionId: string) => {
    if (!savedCourseId) return;
    const db = supabase as any;
    const { data: ver } = await db.from('course_versions').select('version_number, changes_description, created_at, course_snapshot').eq('id', versionId).maybeSingle();
    if (!ver) return;
    const blob = new Blob([JSON.stringify(ver, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `course-${savedCourseId}-v${(ver as { version_number?: number }).version_number ?? versionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const connectGoogleDrive = () => {
    // Google Drive OAuth: Phase 1, Sprint 7-8. For now simulate connection; wire to GOOGLE_CLIENT_ID and redirect when ready.
    setTimeout(() => {
      setDriveConnected(true);
    }, 1000);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDriveUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const type = file.type.startsWith('video/') ? 'video' : 'document';
    setDriveFiles((prev) => [
      {
        id: Date.now(),
        name: file.name,
        size: formatFileSize(file.size),
        type,
        modified: new Date().toLocaleDateString(),
      },
      ...prev,
    ]);
    showSaveMessage(`Added "${file.name}" to your Drive file list (local session).`);
  };

  const handleCopyDriveFileName = async (name: string) => {
    try {
      await navigator.clipboard.writeText(name);
      showSaveMessage(`Copied "${name}" to clipboard.`);
    } catch {
      showSaveMessage('Could not copy file name.');
    }
  };

  const parseTimeToSecondsForSave = (time: string): number => {
    const parsed = parseHHMMSSToSeconds(time);
    if (parsed !== null) return parsed;
    const parts = time.split(':').map(Number);
    if (parts.length >= 2) return parts[0] * 60 + (parts[1] ?? 0);
    if (parts.length === 1) return parts[0] ?? 0;
    return 0;
  };

  /** Strip editor-only fields before POST so large imports serialize reliably. */
  const buildStructureSaveBody = () => ({
    title: courseData.title,
    description: courseData.description,
    modules: courseData.modules.map((mod, mi) => ({
      title: mod.title,
      order: mod.order ?? mi,
      lessons: mod.lessons.map((les, li) => ({
        title: les.title,
        order: les.order ?? li,
        duration: les.duration,
        content: les.content.map((item, ci) => {
          const base = { type: item.type, order: item.order ?? ci };
          if (item.type === 'video' && item.videoSegment) {
            const vs = item.videoSegment;
            return {
              ...base,
              videoSegment: {
                name: vs.name,
                source: vs.source,
                sourceUrl: vs.sourceUrl,
                startTime: vs.startTime,
                endTime: vs.endTime,
                duration: vs.duration,
                startTimestamp: vs.startTimestamp,
                endTimestamp: vs.endTimestamp,
              },
            };
          }
          if (item.type === 'reading' && item.reading) {
            return { ...base, reading: item.reading };
          }
          if (item.type === 'quiz' && item.quiz) {
            return {
              ...base,
              quiz: {
                title: item.quiz.title,
                passingScore: item.quiz.passingScore,
                formUrl: item.quiz.formUrl,
                formEntryIdWebhook: item.quiz.formEntryIdWebhook,
              },
            };
          }
          if (item.type === 'form' && item.form) {
            return { ...base, form: { title: item.form.title, formUrl: item.form.formUrl } };
          }
          if (item.type === 'assessment' && item.assessment) {
            return { ...base, assessment: item.assessment };
          }
          return base;
        }),
      })),
    })),
  });

  const handleSave = async (options?: { silent?: boolean }): Promise<string | null> => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setCourseData(prev => ({ ...prev, lastEdited: 'Just now' }));
      if (!options?.silent) {
        showSaveMessage('Demo mode: course not persisted. Set NEXT_PUBLIC_SUPABASE_URL in .env.local and sign in to save.');
      }
      return null;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        showSaveMessage('Sign in to save courses. Use the "Sign In" button in the sidebar.');
        return null;
      }
      // Supabase generated types may omit schema tables
      const db = supabase as any;
      const wasNewCourse = !savedCourseId;
      let finalCourseId: string;
      if (savedCourseId) {
        finalCourseId = savedCourseId;
      } else {
        const newRes = await fetch('/api/instructor/courses/new', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            title: courseData.title,
            description: courseData.description,
          }),
        });
        if (!newRes.ok) {
          const errData = await newRes.json().catch(() => ({}));
          const msg = (errData as { error?: string })?.error || newRes.statusText || 'Failed to create course';
          const details = (errData as { details?: string })?.details;
          throw new Error(details ? `${msg}: ${details}` : msg);
        }
        const newBody = (await newRes.json()) as { id?: string };
        const courseId = newBody.id;
        if (!courseId) throw new Error('Course created but no id returned');
        setSavedCourseId(courseId);
        finalCourseId = courseId;
        try {
          localStorage.removeItem('create_course_draft_new');
        } catch {
          // ignore
        }
      }

      const structRes = await fetch(`/api/instructor/courses/${finalCourseId}/structure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(buildStructureSaveBody()),
      });
      if (!structRes.ok) {
        const errData = await structRes.json().catch(() => ({}));
        const msg = (errData as { error?: string })?.error || structRes.statusText || 'Failed to save course structure';
        const details = (errData as { details?: string })?.details;
        const context = (errData as { context?: string })?.context;
        const full = [msg, details, context].filter(Boolean).join(' — ');
        throw new Error(full);
      }
      // Record version history (lesson/module level tracking)
      try {
        const { data: maxVer } = await db.from('course_versions').select('version_number').eq('course_id', finalCourseId).order('version_number', { ascending: false }).limit(1).maybeSingle();
        const nextVersion = (maxVer as { version_number: number } | null)?.version_number != null ? (maxVer as { version_number: number }).version_number + 1 : 1;
        await db.from('course_versions').update({ is_current: false }).eq('course_id', finalCourseId);
        await db.from('course_versions').insert({
          course_id: finalCourseId,
          version_number: nextVersion,
          changes_description: `Saved: ${courseData.modules.length} module(s), ${courseData.modules.reduce((acc, m) => acc + m.lessons.length, 0)} lesson(s)`,
          created_by: userId,
          is_current: true,
          course_snapshot: { title: courseData.title, description: courseData.description, modules: courseData.modules }
        });
        const { data: versionRows } = await db.from('course_versions').select('id, version_number, changes_description, created_at, is_current').eq('course_id', finalCourseId).order('version_number', { ascending: false });
        if (versionRows?.length) {
          setVersions((versionRows as { id: string; version_number: number; changes_description: string | null; created_at: string; is_current: boolean }[]).map(v => ({
            id: v.id,
            name: `Version ${v.version_number}`,
            changes: v.changes_description || 'No description',
            timestamp: new Date(v.created_at).toLocaleString(),
            isCurrent: !!v.is_current,
            author: 'You'
          })));
        }
      } catch (_) {
        // course_versions table or RLS may not exist; save still succeeded
      }
      let notifiedCount: number | null = null;
      if (courseData.status === 'published') {
        try {
          const notifyRes = await fetch(`/api/instructor/courses/${finalCourseId}/notify-update`, {
            method: 'POST',
            credentials: 'include',
          });
          if (notifyRes.ok) {
            const body = await notifyRes.json().catch(() => ({}));
            notifiedCount = typeof (body as { notified?: number }).notified === 'number' ? (body as { notified: number }).notified : null;
          } else {
            const body = await notifyRes.json().catch(() => ({}));
            const apiError = (body as { error?: string })?.error;
            showSaveMessage(`Course saved, but notifications failed${apiError ? `: ${apiError}` : '.'}`);
          }
        } catch {
          // Save should remain successful if notifications fail.
        }
      }

      setCourseData(prev => ({ ...prev, lastEdited: 'Just now' }));
      if (!options?.silent) {
        const baseMsg = wasNewCourse ? 'Course saved to database.' : 'Course updated.';
        const notifyMsg = notifiedCount === null
          ? ''
          : notifiedCount > 0
            ? ` Notified ${notifiedCount} learner${notifiedCount === 1 ? '' : 's'}.`
            : ' No enrolled learners to notify yet.';
        showSaveMessage(baseMsg + notifyMsg);
      }
      onCourseSaved?.(finalCourseId);
      return finalCourseId;
    } catch (e: unknown) {
      const err = e as { message?: string; code?: string; details?: string };
      let msg = err?.message || 'Failed to save course.';
      if (msg === 'Failed to fetch') {
        msg = 'Network error while saving. Ensure the dev server is running, SUPABASE_SERVICE_ROLE_KEY is set in .env.local (then restart npm run dev), and try Save again.';
      }
      if (typeof err?.details === 'string') msg += ` (${err.details})`;
      if (msg.includes('row-level security') || msg.includes('RLS') || msg.includes('policy')) {
        const mentionsCoursesTable = /table\s+[`'"]?courses[`'"]?/i.test(msg) || /\bcourses\b/i.test(msg) && msg.toLowerCase().includes('row-level security');
        if (mentionsCoursesTable) {
          msg += ' For course RLS, run database/FIX_COURSES_INSERT_RLS.sql in Supabase (or apply migration fix_courses_insert_rls_policy). Ensure the latest app is deployed: new saves use POST /api/instructor/courses/new (requires SUPABASE_SERVICE_ROLE_KEY). Stay signed in when saving.';
        } else {
          msg += ' Run database/FIX_LESSONS_RLS.sql in Supabase SQL Editor. Stay signed in to the app when saving (so your session is sent). For more help run database/DEBUG_LESSONS_RLS.sql.';
        }
      }
      if (msg.toLowerCase().includes('video_segments') && !/column|schema cache|does not exist/i.test(msg)) {
        msg += ' Run database/FIX_VIDEO_SEGMENTS_RLS.sql in Supabase SQL Editor so video links and timestamps can be saved.';
      }
      if (msg.toLowerCase().includes('reading_materials') || msg.toLowerCase().includes('does not exist')) {
        msg += ' Run database/ADD_READING_SUPPORT.sql in Supabase if you use reading content.';
      }
      if (msg.toLowerCase().includes('external_assessments') || msg.toLowerCase().includes('content_type') && msg.toLowerCase().includes('assessment')) {
        msg += ' Run database/ADD_EXTERNAL_ASSESSMENTS.sql in Supabase SQL Editor to save assessment content.';
      }
      showSaveMessage(msg);
      return null;
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

    // Save latest structure first (assessment-only courses are valid — no minimum content check).
    const savedId = await handleSave({ silent: true });
    const courseId = initialCourseId || savedCourseId || savedId;
    if (!courseId) {
      showSaveMessage('Save the course first, then click Publish again.');
      return;
    }
    if (savedId === null) {
      showSaveMessage('Could not save course before publishing. Fix any save errors above, then try again.');
      return;
    }

    try {
      const publishRes = await fetch(`/api/instructor/courses/${courseId}/publish`, {
        method: 'POST',
        credentials: 'include',
      });
      const publishData = await publishRes.json().catch(() => ({})) as { error?: string; course?: { status?: string } };
      if (!publishRes.ok) {
        showSaveMessage(publishData.error ?? 'Failed to publish course.');
        return;
      }
      if (publishData.course?.status !== 'published') {
        showSaveMessage('Publish did not update course status. Check SUPABASE_SERVICE_ROLE_KEY and try again.');
        return;
      }

      let notifiedCount: number | null = null;
      try {
        const notifyRes = await fetch(`/api/instructor/courses/${courseId}/notify-update`, {
          method: 'POST',
          credentials: 'include',
        });
        if (notifyRes.ok) {
          const body = await notifyRes.json().catch(() => ({}));
          notifiedCount = typeof (body as { notified?: number }).notified === 'number' ? (body as { notified: number }).notified : null;
        } else {
          const body = await notifyRes.json().catch(() => ({}));
          const apiError = (body as { error?: string })?.error;
          showSaveMessage(`Course published, but notifications failed${apiError ? `: ${apiError}` : '.'}`);
        }
      } catch {
        // Publish succeeded even if notifications fail.
      }

      setCourseData(prev => ({ ...prev, status: 'published', lastEdited: 'Just now' }));
      invalidateClientCache('instructor:my-courses');
      onCourseSaved?.(courseId);
      const notifyMsg = notifiedCount === null
        ? ''
        : notifiedCount > 0
          ? ` Notified ${notifiedCount} learner${notifiedCount === 1 ? '' : 's'}.`
          : ' No enrolled learners to notify yet.';
      showSaveMessage('Course published.' + notifyMsg);
    } catch (e: unknown) {
      showSaveMessage(e instanceof Error ? e.message : 'Failed to publish.');
    }
  };

  if (initialCourseId && courseLoadState === 'loading') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-8">
        <p className="text-gray-600">Loading course…</p>
      </div>
    );
  }
  if (initialCourseId && courseLoadState === 'error') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-8">
        <p className="text-gray-700 font-medium">Could not load course.</p>
        <button
          onClick={() => onBackToCourses?.()}
          className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
        >
          ← Back to Courses
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {saveMessage && (
        <div className="bg-brand/10 border-b border-brand/30 px-6 py-2 text-sm text-brand flex-shrink-0">
          {saveMessage}
        </div>
      )}
      <div className="flex flex-1 min-h-0">
      {/* Course Structure Sidebar */}
      <div className="w-96 min-w-[20rem] surface-1 border-r border-line overflow-auto flex-shrink-0">
        <div className="p-6 border-b border-line">
          <h3 className="text-lg font-bold mb-2 text-content">Course Structure</h3>
          <p className="text-sm text-content-secondary">Drag to reorder modules and lessons. Use the top bar for import and organize.</p>
        </div>

        {savedCourseId && (
          <div className="px-6 pt-4">
            <AssessmentGradingPanel courseId={savedCourseId} />
          </div>
        )}

        <div className="p-6">
          <div className="space-y-3">
            {courseData.modules.map((module, moduleIdx) => {
              const moduleCollapsed = collapsedSidebarModules.has(module.id);
              return (
              <div 
                key={module.id}
                draggable
                onDragStart={(e) => handleDragStart(e, 'module', module.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, 'module', module.id)}
                className={`p-4 rounded-xl border-2 transition-all ${
                  currentModule === moduleIdx 
                    ? 'bg-brand/10 border-brand shadow-md' 
                    : 'border-line hover:border-brand/40 hover:bg-overlay/50'
                } ${draggedItem?.type === 'module' && draggedItem.id === module.id ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-start flex-1 min-w-0 gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSidebarModule(module.id);
                      }}
                      className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 flex-shrink-0 mt-0.5"
                      aria-label={moduleCollapsed ? 'Expand module' : 'Collapse module'}
                    >
                      {moduleCollapsed ? (
                        <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      )}
                    </button>
                    <Menu className="w-4 h-4 text-gray-400 mr-1 cursor-move flex-shrink-0 mt-0.5" />
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
                        className="font-semibold text-sm w-full border border-blue-500 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:text-white dark:border-blue-400"
                        autoFocus
                      />
                    ) : (
                      <p
                        className="font-semibold text-sm flex-1 cursor-pointer break-words leading-snug dark:text-white"
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
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {currentModule === moduleIdx && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteModule(module.id, e)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/40 transition-colors"
                      title="Delete module"
                      aria-label="Delete module"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-content-muted mb-2 pl-6">
                  <span>{module.lessons.length} lessons</span>
                  <span>{module.duration}</span>
                </div>
                
                {/* Lessons within module */}
                {!moduleCollapsed && module.lessons.length > 0 && (
                  <div className="mt-3 space-y-2 pl-4 border-l-2 border-gray-200 dark:border-gray-600">
                    {module.lessons.map((lesson, lessonIdx) => (
                      <div
                        key={lesson.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, 'lesson', lesson.id, module.id)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, 'lesson', lesson.id, module.id, lesson.id)}
                        onClick={() => {
                          setCurrentModule(moduleIdx);
                          setCurrentLesson(lessonIdx);
                          setSelectedContent(0);
                        }}
                        className={`p-3 rounded-lg border transition-all cursor-pointer ${
                          currentModule === moduleIdx && currentLesson === lessonIdx
                            ? 'bg-brand/15 border-brand'
                            : 'bg-raised border-line hover:border-brand/40'
                        } ${draggedItem?.type === 'lesson' && draggedItem.id === lesson.id ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-start w-full gap-2">
                          <Menu className="w-3 h-3 text-gray-400 cursor-move flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold break-words leading-snug text-content">{lesson.order + 1}. {lesson.title}</p>
                            <div className="flex items-center justify-between mt-1 text-xs text-content-muted gap-2">
                              <span className="flex-shrink-0">{lesson.content.length} items</span>
                              <span className="flex-shrink-0">{lesson.duration}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteLesson(moduleIdx, lesson.id, e)}
                            className="p-1 rounded text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/40 transition-colors flex-shrink-0"
                            title="Delete lesson"
                            aria-label="Delete lesson"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {!moduleCollapsed && (
                <button
                  onClick={() => handleAddLesson(module.id)}
                  className="mt-2 w-full text-xs px-3 py-1.5 border border-dashed border-line rounded-lg text-content-secondary hover:border-brand hover:text-brand hover:bg-brand/5 transition-all flex items-center justify-center"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Lesson
                </button>
                )}
              </div>
            );
            })}
            
            <button 
              onClick={handleAddModule}
              className="w-full p-4 border-2 border-dashed border-line rounded-xl text-content-secondary hover:border-brand hover:text-brand hover:bg-brand/5 transition-all flex items-center justify-center font-semibold"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Module
            </button>
          </div>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 overflow-auto bg-canvas">
        {/* Header */}
        <div className="surface-1 border-b border-line p-6 sticky top-0 z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1">
              <input 
                type="text" 
                value={courseData.title}
                onChange={(e) => setCourseData({ ...courseData, title: e.target.value })}
                className="text-3xl font-bold border-none focus:outline-none focus:ring-2 focus:ring-brand/50 rounded px-2 w-full bg-transparent text-content placeholder:text-content-muted"
              />
              <div className="flex items-center space-x-4 mt-2 text-sm text-content-secondary">
                <span>Last edited {courseData.lastEdited}</span>
                <span className={`c-badge ${courseData.status === 'published' ? 'c-badge-published' : 'c-badge-draft'}`}>
                  {courseData.status}
                </span>
              </div>
            </div>
            <div className="flex space-x-3">
              <button 
                onClick={() => setPreviewMode(!previewMode)}
                className="c-btn c-btn-ghost px-6 py-3 font-semibold flex items-center"
              >
                <Eye className="w-5 h-5 mr-2" />
                Preview
              </button>
              <button 
                onClick={() => void handleSave()}
                className="c-btn c-btn-primary px-6 py-3 font-semibold flex items-center shadow-lg"
              >
                <Save className="w-5 h-5 mr-2" />
                Save Changes
              </button>
              <button 
                onClick={handlePublish}
                className="c-btn px-6 py-3 font-semibold flex items-center shadow-lg text-[#080808]"
                style={{ background: 'var(--c-ok)' }}
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Publish Course
              </button>
            </div>
          </div>
        </div>

        {savedCourseId && (
          <div className="px-8 pt-4">
            <AssessmentGradingPanel courseId={savedCourseId} />
          </div>
        )}

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
                  className="text-2xl font-bold w-full max-w-4xl border border-transparent focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/50 rounded-lg px-3 py-2 bg-transparent text-content placeholder:text-content-muted"
                />
                <div className="flex flex-wrap items-center justify-between gap-3 mt-2">
                  <p className="text-sm text-content-secondary">{currentLessonData.duration} • {currentLessonData.content.length} content items</p>
                  <button
                    type="button"
                    onClick={() => setShowStructurePanel(true)}
                    className={`${courseEditorPillBtn} flex-shrink-0`}
                  >
                    <LayoutList className="w-4 h-4" />
                    Organize structure
                  </button>
                </div>
              </div>

              {/* Content Items */}
              <div className="space-y-4 mb-6">
                {currentLessonData.content.map((content, idx) => (
                  <div
                    key={content.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, 'content', content.id, currentModuleData.id, currentLessonData.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, 'content', content.id, currentModuleData.id, currentLessonData.id)}
                    onClick={() => {
                      setSelectedContent(idx);
                      if (lessonPreviewMode === 'combined') setCombinedSegmentIndex(idx);
                    }}
                    className={`p-6 rounded-xl border-2 transition-all cursor-pointer ${
                      idx === selectedContent || (lessonPreviewMode === 'combined' && idx === combinedSegmentIndex)
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-500 shadow-lg'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500'
                    } ${draggedItem?.type === 'content' && draggedItem.id === content.id ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start flex-1">
                        <Menu className="w-5 h-5 text-gray-400 dark:text-gray-500 mr-3 mt-1 cursor-move" />
                        <div className="flex-1">
                          {content.type === 'video' && (
                            <>
                              {content.videoSegment ? (
                                <>
                                  <div className="flex items-center mb-2">
                                    <Video className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
                                    <span className="font-semibold text-gray-900 dark:text-white">{content.videoSegment.name}</span>
                                    {content.videoSegment.source === 'youtube' && (
                                      <Youtube className="w-4 h-4 text-red-600 dark:text-red-400 ml-2" />
                                    )}
                                    {content.videoSegment.source === 'google_drive' && (
                                      <Folder className="w-4 h-4 text-green-600 dark:text-green-400 ml-2" />
                                    )}
                                    {content.videoSegment.source === 'external_url' && (
                                      <Video className="w-4 h-4 text-violet-600 dark:text-violet-400 ml-2" />
                                    )}
                                    {content.videoSegment.startTimestamp !== undefined && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setShowStreamSettings(true);
                                        }}
                                        className="ml-2 px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded flex items-center"
                                      >
                                        <Radio className="w-3 h-3 mr-1" />
                                        Streaming
                                      </button>
                                    )}
                                  </div>
                                  {(content.videoSegment.sourceUrl || content.videoSegment.source !== 'upload') && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 truncate max-w-full" title={content.videoSegment.sourceUrl || ''}>
                                      <Link className="w-3 h-3 inline-block mr-1 align-middle" />
                                      {content.videoSegment.sourceUrl ? (
                                        <a href={content.videoSegment.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-blue-600 dark:text-blue-400 hover:underline truncate inline-block max-w-full">
                                          {content.videoSegment.sourceUrl}
                                        </a>
                                      ) : (
                                        <span>Link not set</span>
                                      )}
                                    </div>
                                  )}
                                  <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                                    <span className="flex items-center">
                                      <Clock className="w-4 h-4 mr-1" />
                                      {content.videoSegment.duration}
                                    </span>
                                    <span className="flex items-center">
                                      <Video className="w-4 h-4 mr-1" />
                                      {content.videoSegment.size}
                                    </span>
                                    {content.videoSegment.startTimestamp !== undefined && (
                                      <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                                        {formatSecondsToTime(content.videoSegment.startTimestamp)} - {formatSecondsToTime(content.videoSegment.endTimestamp || 0)}
                                      </span>
                                    )}
                                  </div>
                                </>
                              ) : (
                                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                                  <Video className="w-5 h-5 flex-shrink-0" />
                                  <span className="text-sm">Video — link not loaded. Save and reopen, or re-add the video link.</span>
                                </div>
                              )}
                            </>
                          )}
                          {content.type === 'quiz' && content.quiz && (
                            <>
                              <div className="flex items-center mb-2">
                                <HelpCircle className="w-5 h-5 text-purple-600 dark:text-purple-400 mr-2" />
                                <span className="font-semibold text-gray-900 dark:text-white">{content.quiz.title}</span>
                                {content.quiz.formUrl && (
                                  <span className="ml-2 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded flex items-center">
                                    <Link className="w-3 h-3 mr-1" />
                                    Google Form
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {content.quiz.formUrl ? 'Embedded Google Form' : `${content.quiz.questions.length} questions`} • Passing score: {content.quiz.passingScore}%
                              </div>
                            </>
                          )}
                          {content.type === 'assessment' && content.assessment && (
                            <>
                              <div className="flex items-center mb-2">
                                <Award className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mr-2" />
                                <span className="font-semibold text-gray-900 dark:text-white">{content.assessment.title}</span>
                                <span className="ml-2 text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded">
                                  {content.assessment.accessMode === 'proctored_portal' ? 'Final exam' : 'Module quiz'}
                                </span>
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                Assessment Pro · Passing score: {content.assessment.passingScore}%
                              </div>
                            </>
                          )}
                          {content.type === 'form' && content.form && (
                            <>
                              <div className="flex items-center mb-2">
                                <FileText className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" />
                                <span className="font-semibold text-gray-900 dark:text-white">{content.form.title}</span>
                                {content.form.formUrl && (
                                  <span className="ml-2 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded flex items-center">
                                    <Link className="w-3 h-3 mr-1" />
                                    Google Form
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {content.form.formUrl ? 'Embedded Google Form' : 'Form'}
                              </div>
                            </>
                          )}
                          {content.type === 'reading' && content.reading && (
                            <>
                              <div className="flex items-center mb-2">
                                <BookOpen className="w-5 h-5 text-amber-600 dark:text-amber-400 mr-2" />
                                <span className="font-semibold text-gray-900 dark:text-white">{content.reading.title}</span>
                                {content.reading.type === 'url' && (
                                  <span className="ml-2 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded flex items-center">
                                    <Link className="w-3 h-3 mr-1" />
                                    Link
                                  </span>
                                )}
                                {content.reading.type === 'native' && (
                                  <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded">Native text</span>
                                )}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {content.reading.type === 'url' && content.reading.url && (
                                  <a href={content.reading.url} target="_blank" rel="noopener noreferrer" className="text-amber-600 dark:text-amber-400 hover:underline truncate block max-w-md">{content.reading.url}</a>
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
                            if (content.type === 'assessment' && content.assessment) {
                              handleStartEditAssessment(content, idx);
                              return;
                            }
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
                          className="p-2 bg-white dark:bg-gray-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/40 shadow transition-all"
                        >
                          <Edit className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteContent(currentLessonData.id, content.id);
                          }}
                          className="p-2 bg-white dark:bg-gray-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/40 shadow transition-all"
                        >
                          <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Content Buttons */}
              <div className="flex flex-wrap gap-3 mb-6">
                <button
                  onClick={() => handleAddContent('video')}
                  className="c-btn c-btn-primary px-6 py-3 font-semibold flex items-center shadow-lg"
                >
                  <Video className="w-5 h-5 mr-2" />
                  Add Video
                </button>
                <button
                  onClick={() => handleAddContent('reading')}
                  className="c-btn px-6 py-3 font-semibold flex items-center shadow-lg border border-warning/40 bg-warning-subtle text-warning hover:bg-warning/20"
                >
                  <BookOpen className="w-5 h-5 mr-2" />
                  Add Reading
                </button>
                <button
                  onClick={() => handleAddContent('assessment')}
                  className={`c-btn px-6 py-3 font-semibold flex items-center shadow-lg border ${
                    showAssessmentPanel
                      ? 'border-brand bg-brand/20 text-brand ring-2 ring-brand/30'
                      : 'border-line bg-raised text-content hover:bg-overlay'
                  }`}
                >
                  <Award className="w-5 h-5 mr-2" />
                  {showAssessmentPanel ? 'Close Assessment' : 'Add Assessment'}
                </button>
                <button
                  onClick={() => openGoogleFormModal('form')}
                  className="c-btn px-6 py-3 font-semibold flex items-center shadow-lg border border-line bg-raised text-content-secondary hover:bg-overlay"
                >
                  <FileText className="w-5 h-5 mr-2" />
                  Add Google Form
                </button>
              </div>

              {showAssessmentPanel && editingAssessmentContentId == null && (
                <AddAssessmentPanel
                  key={`add-assessment-${assessmentAddSession}`}
                  sessionKey={assessmentAddSession}
                  active
                  onClose={() => setShowAssessmentPanel(false)}
                  onAdd={handleAddAssessmentContent}
                />
              )}

              {editingAssessmentContent?.type === 'assessment' && editingAssessmentContent.assessment && (
                <div className="mb-6 rounded-2xl border-2 border-indigo-300 dark:border-indigo-800 bg-white dark:bg-gray-800 shadow-lg overflow-hidden">
                  <AddAssessmentPanel
                    key={`edit-assessment-${editingAssessmentContentId}-${editingAssessmentContent.assessment.assessmentProId}`}
                    active
                    embedded
                    mode="edit"
                    initialAssessment={{
                      title: editingAssessmentContent.assessment.title,
                      description: editingAssessmentContent.assessment.description,
                      assessmentProId: editingAssessmentContent.assessment.assessmentProId,
                      accessMode: editingAssessmentContent.assessment.accessMode,
                      passingScore: editingAssessmentContent.assessment.passingScore,
                    }}
                    onClose={handleCloseAssessmentEdit}
                    onAdd={() => {}}
                    onUpdate={handleUpdateAssessmentContent}
                  />
                </div>
              )}

              {/* Combined (learner) view — one window: video + reading + quiz + form in order, like TakeCourse (from e359e8bd) */}
              {totalSteps > 0 && currentStepContent && !editingAssessmentContentId && (
                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border-2 border-blue-200 dark:border-blue-900/50 mb-6">
                  <div className="rounded-2xl overflow-hidden shadow-xl relative bg-gray-900 dark:bg-gray-950" style={{ minHeight: '50vh' }}>
                    {currentStepContent.type === 'video' && currentStepContent.videoSegment && (() => {
                      const seg = currentStepContent.videoSegment;
                      const sourceUrl = seg.sourceUrl || '';
                      const ytId = seg.source === 'youtube' ? getYouTubeVideoId(sourceUrl) : null;
                      const driveId = seg.source === 'google_drive' ? getGoogleDriveFileId(sourceUrl) : null;
                      const externalUrl = seg.source === 'external_url' && sourceUrl ? sourceUrl : null;
                      const segStartSec = seg.startTimestamp ?? parseHHMMSSToSeconds(seg.startTime || '00:00:00') ?? parseTimeToSeconds(seg.startTime || '0:00');
                      const segEndSec = seg.endTimestamp ?? parseHHMMSSToSeconds(seg.endTime || '00:00:00') ?? parseTimeToSeconds(seg.endTime || seg.duration || '0:00');
                      const useYtSegmentPlayer = ytId && segEndSec > segStartSec;
                      const embedUrl = ytId && !useYtSegmentPlayer
                        ? getYouTubeEmbedUrl(ytId, segStartSec, segEndSec)
                        : driveId
                          ? getGoogleDriveEmbedUrl(driveId, seg.startTimestamp ?? undefined)
                          : (externalUrl ? getExternalVideoEmbedUrl(externalUrl, seg.startTimestamp ?? undefined) : null);
                      return (
                        <>
                          {lessonPreviewMode === 'combined' && (ytIdCombined || driveIdCombined) && currentSegmentInCombined?.videoSegment ? (
                            <div className="aspect-video w-full relative">
                              {ytIdCombined ? (
                                <YouTubeSegmentPlayer
                                  key={`combined-yt-${ytIdCombined}-${segStartSec}-${segEndSec}-${combinedSegmentIndex}`}
                                  videoId={ytIdCombined}
                                  startSeconds={segStartSec}
                                  endSeconds={segEndSec > segStartSec ? segEndSec : undefined}
                                  title={seg.name}
                                  className="absolute inset-0 w-full h-full"
                                />
                              ) : (
                                <video
                                  ref={combinedDriveVideoRef}
                                  key={`combined-drive-${driveIdCombined}-${segStartSec}-${combinedSegmentIndex}`}
                                  src={driveIdCombined ? getDriveProxyVideoUrl(driveIdCombined) : undefined}
                                  onCanPlay={() => setCombinedDrivePlayerReady(true)}
                                  onError={() => setCombinedDrivePlayerReady(false)}
                                  className="absolute inset-0 w-full h-full object-contain"
                                  controls
                                  onPlay={() => setCombinedPlaying(true)}
                                  onPause={() => setCombinedPlaying(false)}
                                />
                              )}
                              <div className="absolute top-2 right-2 bg-purple-600 text-white px-2 py-1 rounded text-xs font-semibold flex items-center pointer-events-none">
                                <Radio className="w-3 h-3 mr-1" /> Segment: {formatSecondsToTime(segStartSec)} - {formatSecondsToTime(segEndSec || 0)}
                              </div>
                            </div>
                          ) : useYtSegmentPlayer ? (
                            <div className="aspect-video w-full relative">
                              <YouTubeSegmentPlayer key={`seg-yt-${ytId}-${segStartSec}-${segEndSec}-${selectedContent}`} videoId={ytId!} startSeconds={segStartSec} endSeconds={segEndSec > segStartSec ? segEndSec : undefined} title={seg.name} className="absolute inset-0 w-full h-full" />
                              <div className="absolute top-2 right-2 bg-purple-600 text-white px-2 py-1 rounded text-xs font-semibold flex items-center">
                                <Radio className="w-3 h-3 mr-1" /> Segment: {formatSecondsToTime(segStartSec)} - {formatSecondsToTime(segEndSec || 0)}
                              </div>
                            </div>
                          ) : embedUrl ? (
                            <div className="aspect-video w-full relative">
                              {(seg.source === 'google_drive' || seg.source === 'external_url') && seg.endTimestamp != null && seg.endTimestamp > (seg.startTimestamp ?? 0) ? (
                                <SegmentEnforcedIframePlayer embedUrl={embedUrl} startSeconds={seg.startTimestamp ?? 0} endSeconds={seg.endTimestamp ?? undefined} title={seg.name} className="absolute inset-0 w-full h-full" />
                              ) : (
                                <iframe title={seg.name} src={embedUrl} className="absolute inset-0 w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
                              )}
                              {seg.startTimestamp !== undefined && (
                                <div className="absolute top-2 right-2 bg-purple-600 text-white px-2 py-1 rounded text-xs font-semibold flex items-center">
                                  <Radio className="w-3 h-3 mr-1" /> Segment: {formatSecondsToTime(seg.startTimestamp)} - {formatSecondsToTime(seg.endTimestamp || 0)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="aspect-video w-full flex items-center justify-center bg-gray-800 text-gray-400">Add video source</div>
                          )}
                        </>
                      );
                    })()}
                    {currentStepContent.type === 'reading' && currentStepContent.reading && (
                      <div className="flex flex-col h-full min-h-[50vh]">
                        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            {currentStepContent.reading.title || 'Reading'}
                          </span>
                        </div>
                        <div className="flex-1 min-h-0 overflow-auto bg-white dark:bg-gray-900 select-none">
                          {currentStepContent.reading.type === 'url' && currentStepContent.reading.url ? (
                            <iframe title={currentStepContent.reading.title || 'Document'} src={getReadingEmbedUrl(currentStepContent.reading.url)} className="w-full h-full min-h-[45vh] border-0" allow="fullscreen" sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox" />
                          ) : currentStepContent.reading.type === 'native' ? (
                            <div className="p-6">
                              <ReadingContentRenderer body={currentStepContent.reading.body || ''} format={currentStepContent.reading.format ?? 'plain'} className="text-gray-800 dark:text-gray-200 prose dark:prose-invert max-w-none" />
                            </div>
                          ) : (
                            <div className="p-6 text-gray-500">Add a link or native text.</div>
                          )}
                        </div>
                      </div>
                    )}
                    {currentStepContent.type === 'quiz' && (
                      <div className="flex flex-col min-h-[50vh]">
                        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <HelpCircle className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            {currentStepContent.quiz?.title || 'Quiz'}
                          </span>
                        </div>
                        {currentStepContent.quiz?.formUrl ? (
                          <iframe title={currentStepContent.quiz?.title || 'Quiz'} src={getFormEmbedUrl(currentStepContent.quiz?.formUrl ?? '')} className="w-full flex-1 min-h-[45vh] border-0" allow="fullscreen" sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox" />
                        ) : (
                          <div className="p-6 text-gray-500 dark:text-gray-400">Add a Google Form URL to this quiz.</div>
                        )}
                      </div>
                    )}
                    {currentStepContent.type === 'form' && (
                      <div className="flex flex-col min-h-[50vh]">
                        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-green-600 dark:text-green-400" />
                            {currentStepContent.form?.title || 'Form'}
                          </span>
                        </div>
                        {currentStepContent.form?.formUrl ? (
                          <iframe title={currentStepContent.form?.title || 'Form'} src={getFormEmbedUrl(currentStepContent.form?.formUrl ?? '')} className="w-full flex-1 min-h-[45vh] border-0" allow="fullscreen" sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox" />
                        ) : (
                          <div className="p-6 text-gray-500 dark:text-gray-400">Add a form URL.</div>
                        )}
                      </div>
                    )}
                    {currentStepContent.type === 'assessment' && (
                      <div className="flex flex-col min-h-[50vh]">
                        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <Award className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            {currentStepContent.assessment?.title || 'Assessment'}
                          </span>
                          {currentStepContent.assessment && (
                            <button
                              type="button"
                              onClick={() => {
                                const idx = currentLessonData?.content.findIndex((c) => c.id === currentStepContent.id) ?? -1;
                                if (idx >= 0) handleStartEditAssessment(currentStepContent, idx);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              Edit
                            </button>
                          )}
                        </div>
                        {currentStepContent.assessment?.assessmentProId ? (
                          <div className="flex-1 min-h-0 overflow-auto bg-white dark:bg-gray-900 flex flex-col">
                            <AssessmentPreviewEmbed
                              key={`${currentStepContent.assessment.assessmentProId}-${currentStepContent.assessment.accessMode}`}
                              assessmentProId={currentStepContent.assessment.assessmentProId}
                              title={currentStepContent.assessment.title || 'Assessment'}
                              accessMode={currentStepContent.assessment.accessMode}
                            />
                          </div>
                        ) : (
                          <div className="p-8 flex flex-col items-center justify-center flex-1 text-center">
                            <Award className="w-10 h-10 text-indigo-600 mb-3" />
                            <p className="font-medium text-gray-900 dark:text-white">{currentStepContent.assessment?.title || 'Assessment'}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-md">
                              Link an Assessment Pro quiz to preview it here.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Control bar: step title, Next, two timelines */}
                  <div className="rounded-xl bg-gray-900/95 dark:bg-gray-950 p-5 text-white mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-white">
                        {currentStepContent.type === 'video' && currentStepContent.videoSegment?.name}
                        {currentStepContent.type === 'reading' && (currentStepContent.reading?.title || 'Reading')}
                        {currentStepContent.type === 'quiz' && (currentStepContent.quiz?.title || 'Quiz')}
                        {currentStepContent.type === 'form' && (currentStepContent.form?.title || 'Form')}
                        {currentStepContent.type === 'assessment' && (currentStepContent.assessment?.title || 'Assessment')}
                      </span>
                      <span className="text-sm text-white/90">Step {combinedSegmentIndex + 1} of {totalSteps}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      {(currentStepContent.type === 'reading' || currentStepContent.type === 'quiz' || currentStepContent.type === 'form' || currentStepContent.type === 'assessment') && (
                        <button
                          type="button"
                          onClick={() => { if (combinedSegmentIndex < totalSteps - 1) setCombinedSegmentIndex((i) => i + 1); }}
                          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium"
                        >
                          Next
                        </button>
                      )}
                      {isCurrentStepVideo && (
                        <>
                          <button type="button" onClick={() => setCombinedPlaying((p) => !p)} className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors">
                            {combinedPlaying ? <div className="w-4 h-4 flex items-center justify-center gap-0.5"><div className="w-1 h-3 bg-white rounded-sm" /><div className="w-1 h-3 bg-white rounded-sm" /></div> : <Play className="w-4 h-4 text-white ml-0.5" />}
                          </button>
                          <span className="text-xs text-white/60">{(combinedYtPlayerReady || combinedDrivePlayerReady) ? 'Synced with player' : 'Simulated playback (sync not available for this source)'}</span>
                        </>
                      )}
                    </div>
                    {isCurrentStepVideo && (
                      <div className="mb-3">
                        <div className="w-full bg-gray-600 rounded-full h-2 overflow-hidden">
                          <div className="bg-white h-2 rounded-full transition-all duration-100" style={{ width: `${currentSegmentDurationSec > 0 ? (combinedPlaybackSeconds / currentSegmentDurationSec) * 100 : 0}%` }} />
                        </div>
                      </div>
                    )}
                    <div className="relative w-full h-2.5 bg-gray-700 rounded-full overflow-visible">
                      <div className="absolute inset-y-0 left-0 bg-blue-500 rounded-full transition-all duration-100 z-[1]" style={{ width: `${combinedProgressPct}%` }} />
                      {totalSteps > 1 && allStepsForLesson.slice(0, -1).map((_, i) => (
                        <div key={i} className="absolute top-0 bottom-0 w-px bg-white/80 z-[2]" style={{ left: `${((i + 1) / totalSteps) * 100}%` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Video Preview with Streaming Info (Select step mode) */}
              {lessonPreviewMode !== 'combined' && currentContent?.type === 'video' && currentContent.videoSegment && (() => {
                const seg = currentContent.videoSegment;
                const sourceUrl = seg.sourceUrl || '';
                const segStartSec = seg.startTimestamp ?? parseTimeToSeconds(seg.startTime || '0:00');
                const segEndSec = seg.endTimestamp ?? parseTimeToSeconds(seg.endTime || seg.duration || '0:00');
                const hasValidSegmentEnd = segEndSec > segStartSec;
                const ytId = seg.source === 'youtube' ? getYouTubeVideoId(sourceUrl) : null;
                const driveId = seg.source === 'google_drive' ? getGoogleDriveFileId(sourceUrl) : null;
                const externalUrl = seg.source === 'external_url' && sourceUrl ? sourceUrl : null;
                const useYtSegmentPlayer = ytId && hasValidSegmentEnd;
                const embedUrl = ytId && !useYtSegmentPlayer
                  ? getYouTubeEmbedUrl(ytId, segStartSec, segEndSec)
                  : driveId
                    ? getGoogleDriveEmbedUrl(driveId, segStartSec)
                    : (externalUrl ? getExternalVideoEmbedUrl(externalUrl, segStartSec) : null);
                // Combined preview: steps = all lesson content (segment, document, form, etc.)
                const contentList = currentLessonData?.content ?? [];
                const totalSteps = contentList.length;
                const lessonTotalDurationFormatted = currentLessonData?.duration ?? '0:00';
                const stepDurations = contentList.map((c) => {
                  if (c.type === 'video' && c.videoSegment) {
                    const vs = c.videoSegment;
                    if (vs.startTimestamp != null && vs.endTimestamp != null) return vs.endTimestamp - vs.startTimestamp;
                    return parseTimeToSeconds(vs.duration || '0:00');
                  }
                  return 60;
                });
                const totalLessonSeconds = stepDurations.reduce((a, b) => a + b, 0) || 1;
                const segmentProgress = combinedSegmentDuration > 0 ? combinedPreviewElapsedSeconds / combinedSegmentDuration : 0;
                const sourceLabel = seg.source === 'youtube' ? 'YouTube Video' : seg.source === 'google_drive' ? 'Drive Video' : 'Video';
                const showSimulatedNote = seg.source === 'google_drive' || seg.source === 'external_url';
                return (
                <div key={segIdentity || 'no-segment'} className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border-2 border-blue-200 dark:border-blue-900/50 mb-6">
                  <div className="rounded-2xl mb-6 aspect-video overflow-hidden shadow-xl relative bg-gray-900">
                    {useYtSegmentPlayer ? (
                      <>
                        <YouTubeSegmentPlayer
                          key={`select-yt-${ytId}-${segStartSec}-${segEndSec}-${selectedContent}`}
                          videoId={ytId}
                          startSeconds={segStartSec}
                          endSeconds={segEndSec}
                          title={seg.name}
                          className="absolute inset-0 w-full h-full"
                        />
                        <div className="absolute top-2 right-2 bg-purple-600 text-white px-2 py-1 rounded text-xs font-semibold flex items-center">
                          <Radio className="w-3 h-3 mr-1" />
                          Segment: {formatSecondsToTime(segStartSec)} - {formatSecondsToTime(segEndSec)}
                        </div>
                        {combinedSegmentDuration > 0 && (
                          <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/90 to-transparent px-3 py-2">
                            <div className="w-full bg-white/30 rounded-full h-1.5 mb-2">
                              <div
                                className="bg-white h-1.5 rounded-full transition-all duration-200"
                                style={{ width: `${Math.min(100, (combinedPreviewElapsedSeconds / combinedSegmentDuration) * 100)}%` }}
                              />
                            </div>
                            <span className="text-white text-sm tabular-nums">
                              {formatSecondsToTime(combinedPreviewElapsedSeconds)} / {formatSecondsToTime(combinedSegmentDuration)}
                            </span>
                          </div>
                        )}
                      </>
                    ) : embedUrl ? (
                      <>
                        {(seg.source === 'google_drive' || seg.source === 'external_url') && hasValidSegmentEnd ? (
                          <SegmentEnforcedIframePlayer
                            embedUrl={embedUrl}
                            startSeconds={segStartSec}
                            endSeconds={segEndSec}
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
                        {(seg.startTimestamp !== undefined || seg.startTime) && (
                          <div className="absolute top-2 right-2 bg-purple-600 text-white px-2 py-1 rounded text-xs font-semibold flex items-center">
                            <Radio className="w-3 h-3 mr-1" />
                            Segment: {formatSecondsToTime(segStartSec)} - {formatSecondsToTime(segEndSec)}
                          </div>
                        )}
                        {combinedSegmentDuration > 0 && (
                          <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/90 to-transparent px-3 py-2">
                            <div className="w-full bg-white/30 rounded-full h-1.5 mb-2">
                              <div
                                className="bg-white h-1.5 rounded-full transition-all duration-200"
                                style={{ width: `${Math.min(100, (combinedPreviewElapsedSeconds / combinedSegmentDuration) * 100)}%` }}
                              />
                            </div>
                            <span className="text-white text-sm tabular-nums">
                              {formatSecondsToTime(combinedPreviewElapsedSeconds)} / {formatSecondsToTime(combinedSegmentDuration)}
                            </span>
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

                  {/* Combined preview footer: two playback timers (segment + lesson) */}
                  <div className="rounded-b-2xl overflow-hidden bg-gray-800 dark:bg-gray-900 px-4 py-3 -mb-6">
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <Play className="w-4 h-4 text-white flex-shrink-0" />
                        <span className="text-sm font-medium text-white truncate">{seg.name}</span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-sm text-gray-300 truncate">{sourceLabel}</span>
                        {showSimulatedNote && (
                          <span className="text-xs text-gray-400 whitespace-nowrap">Simulated playback (sync not available for this source)</span>
                        )}
                      </div>
                      <span className="text-sm font-medium text-white flex-shrink-0">Step {selectedContent + 1} of {totalSteps}</span>
                    </div>
                    <div className="mb-2">
                      <div className="text-xs text-gray-400 mb-1">Segment</div>
                      <div className="w-full bg-white/20 rounded-full h-1.5">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full transition-all duration-200"
                          style={{ width: `${Math.min(100, segmentProgress * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 flex rounded-full overflow-hidden bg-gray-700 h-2 gap-px">
                        {contentList.map((_, i) => {
                          const w = totalLessonSeconds > 0 ? (stepDurations[i]! / totalLessonSeconds) * 100 : 100 / (totalSteps || 1);
                          const isPast = i < selectedContent;
                          const isCurrent = i === selectedContent;
                          const fillPct = isPast ? 100 : isCurrent ? segmentProgress * 100 : 0;
                          return (
                            <div
                              key={i}
                              className="relative overflow-hidden rounded-sm transition-all duration-200 min-w-0"
                              style={{ width: `${w}%` }}
                            >
                              <div className="absolute inset-0 bg-white/20" />
                              <div className="absolute inset-y-0 left-0 bg-blue-500 rounded-l-sm transition-all duration-200" style={{ width: `${fillPct}%` }} />
                            </div>
                          );
                        })}
                      </div>
                      <span className="text-sm text-gray-300 tabular-nums flex-shrink-0">{lessonTotalDurationFormatted}</span>
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                    <div className="flex items-start">
                      <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-blue-900 dark:text-blue-200">
                        <p className="font-semibold mb-1">Video Streaming</p>
                        <p>This video will only load and stream the segment between the specified timestamps, reducing bandwidth and improving performance. The video won&apos;t be fully downloaded before playback starts.</p>
                      </div>
                    </div>
                  </div>
                </div>
              ); })()}
              {lessonPreviewMode !== 'combined' && currentContent?.type === 'reading' && currentContent.reading && (
                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border-2 border-amber-200 dark:border-amber-900/50 mb-6">
                  <div className="flex items-center mb-4">
                    <BookOpen className="w-6 h-6 text-amber-600 dark:text-amber-400 mr-2" />
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{currentContent.reading.title}</h3>
                  </div>
                  {currentContent.reading.type === 'url' && currentContent.reading.url ? (
                    <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50" style={{ minHeight: '60vh' }}>
                      <iframe
                        title={currentContent.reading.title}
                        src={currentContent.reading.url.startsWith('http') ? currentContent.reading.url : `https://${currentContent.reading.url}`}
                        className="w-full h-full min-h-[60vh]"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 p-2">
                        Link: <a href={currentContent.reading.url} target="_blank" rel="noopener noreferrer" className="text-amber-600 dark:text-amber-400 hover:underline">{currentContent.reading.url}</a>
                      </p>
                    </div>
                  ) : currentContent.reading.type === 'native' ? (
                    <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-6 min-h-[200px]">
                      <div className="text-gray-800 dark:text-gray-200">
                        <ReadingContentRenderer
                          body={currentContent.reading.body || ''}
                          format={currentContent.reading.format ?? 'plain'}
                          className="text-gray-800 dark:text-gray-200"
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400">Add a link or native text.</p>
                  )}
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mt-4">
                    <div className="flex items-start">
                      <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 mr-3 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-amber-900 dark:text-amber-200">
                        <p className="font-semibold mb-1">Reading material</p>
                        <p>Use a link (Google Docs, Microsoft Office, etc.) or write content with the native text editor when adding reading.</p>
                      </div>
                    </div>
                  </div>
                  {/* Combined preview footer for non-video step */}
                  {currentLessonData && (() => {
                    const contentList = currentLessonData.content;
                    const totalSteps = contentList.length;
                    const lessonTotalDurationFormatted = currentLessonData.duration ?? '0:00';
                    const stepDurations = contentList.map((c) => {
                      if (c.type === 'video' && c.videoSegment) {
                        const vs = c.videoSegment;
                        if (vs.startTimestamp != null && vs.endTimestamp != null) return vs.endTimestamp - vs.startTimestamp;
                        return parseTimeToSeconds(vs.duration || '0:00');
                      }
                      return 60;
                    });
                    const totalLessonSeconds = stepDurations.reduce((a, b) => a + b, 0) || 1;
                    return (
                      <div className="rounded-b-2xl overflow-hidden bg-gray-800 dark:bg-gray-900 px-4 py-3 -mb-6 mt-4">
                        <div className="flex items-center justify-between gap-4 mb-2">
                          <span className="text-sm text-gray-300">Reading</span>
                          <span className="text-sm font-medium text-white">Step {selectedContent + 1} of {totalSteps}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 flex rounded-full overflow-hidden bg-gray-700 h-2 gap-px">
                            {contentList.map((_, i) => {
                              const w = totalLessonSeconds > 0 ? (stepDurations[i]! / totalLessonSeconds) * 100 : 100 / (totalSteps || 1);
                              const fillPct = i <= selectedContent ? 100 : 0;
                              return (
                                <div key={i} className="relative overflow-hidden rounded-sm min-w-0" style={{ width: `${w}%` }}>
                                  <div className="absolute inset-0 bg-white/20" />
                                  <div className="absolute inset-y-0 left-0 bg-blue-500 rounded-l-sm" style={{ width: `${fillPct}%` }} />
                                </div>
                              );
                            })}
                          </div>
                          <span className="text-sm text-gray-300 tabular-nums flex-shrink-0">{lessonTotalDurationFormatted}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
              {lessonPreviewMode !== 'combined' && currentContent?.type === 'quiz' && currentContent.quiz && (
                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border-2 border-green-200 dark:border-green-900/50 mb-6">
                  <div className="flex items-center mb-4">
                    <HelpCircle className="w-6 h-6 text-green-600 dark:text-green-400 mr-2" />
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{currentContent.quiz.title}</h3>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Quiz content (form/embed).</p>
                  {currentLessonData && (() => {
                    const contentList = currentLessonData.content;
                    const totalSteps = contentList.length;
                    const lessonTotalDurationFormatted = currentLessonData.duration ?? '0:00';
                    const stepDurations = contentList.map((c) => {
                      if (c.type === 'video' && c.videoSegment) {
                        const vs = c.videoSegment;
                        if (vs.startTimestamp != null && vs.endTimestamp != null) return vs.endTimestamp - vs.startTimestamp;
                        return parseTimeToSeconds(vs.duration || '0:00');
                      }
                      return 60;
                    });
                    const totalLessonSeconds = stepDurations.reduce((a, b) => a + b, 0) || 1;
                    return (
                      <div className="rounded-b-2xl overflow-hidden bg-gray-800 dark:bg-gray-900 px-4 py-3 -mb-6 mt-4">
                        <div className="flex items-center justify-between gap-4 mb-2">
                          <span className="text-sm text-gray-300">Quiz</span>
                          <span className="text-sm font-medium text-white">Step {selectedContent + 1} of {totalSteps}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 flex rounded-full overflow-hidden bg-gray-700 h-2 gap-px">
                            {contentList.map((_, i) => {
                              const w = totalLessonSeconds > 0 ? (stepDurations[i]! / totalLessonSeconds) * 100 : 100 / (totalSteps || 1);
                              const fillPct = i <= selectedContent ? 100 : 0;
                              return (
                                <div key={i} className="relative overflow-hidden rounded-sm min-w-0" style={{ width: `${w}%` }}>
                                  <div className="absolute inset-0 bg-white/20" />
                                  <div className="absolute inset-y-0 left-0 bg-blue-500 rounded-l-sm" style={{ width: `${fillPct}%` }} />
                                </div>
                              );
                            })}
                          </div>
                          <span className="text-sm text-gray-300 tabular-nums flex-shrink-0">{lessonTotalDurationFormatted}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
              {lessonPreviewMode !== 'combined' && currentContent?.type === 'form' && currentContent.form && (
                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border-2 border-green-200 dark:border-green-900/50 mb-6">
                  <div className="flex items-center mb-4">
                    <FileText className="w-6 h-6 text-green-600 dark:text-green-400 mr-2" />
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{currentContent.form.title}</h3>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Form content.</p>
                  {currentLessonData && (() => {
                    const contentList = currentLessonData.content;
                    const totalSteps = contentList.length;
                    const lessonTotalDurationFormatted = currentLessonData.duration ?? '0:00';
                    const stepDurations = contentList.map((c) => {
                      if (c.type === 'video' && c.videoSegment) {
                        const vs = c.videoSegment;
                        if (vs.startTimestamp != null && vs.endTimestamp != null) return vs.endTimestamp - vs.startTimestamp;
                        return parseTimeToSeconds(vs.duration || '0:00');
                      }
                      return 60;
                    });
                    const totalLessonSeconds = stepDurations.reduce((a, b) => a + b, 0) || 1;
                    return (
                      <div className="rounded-b-2xl overflow-hidden bg-gray-800 dark:bg-gray-900 px-4 py-3 -mb-6 mt-4">
                        <div className="flex items-center justify-between gap-4 mb-2">
                          <span className="text-sm text-gray-300">Form</span>
                          <span className="text-sm font-medium text-white">Step {selectedContent + 1} of {totalSteps}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 flex rounded-full overflow-hidden bg-gray-700 h-2 gap-px">
                            {contentList.map((_, i) => {
                              const w = totalLessonSeconds > 0 ? (stepDurations[i]! / totalLessonSeconds) * 100 : 100 / (totalSteps || 1);
                              const fillPct = i <= selectedContent ? 100 : 0;
                              return (
                                <div key={i} className="relative overflow-hidden rounded-sm min-w-0" style={{ width: `${w}%` }}>
                                  <div className="absolute inset-0 bg-white/20" />
                                  <div className="absolute inset-y-0 left-0 bg-blue-500 rounded-l-sm" style={{ width: `${fillPct}%` }} />
                                </div>
                              );
                            })}
                          </div>
                          <span className="text-sm text-gray-300 tabular-nums flex-shrink-0">{lessonTotalDurationFormatted}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <Video className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h4 className="font-bold text-lg mb-2 text-gray-900 dark:text-white">{courseData.modules.length === 0 ? 'No modules yet' : 'No lesson selected'}</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {courseData.modules.length === 0 ? 'Add your first module in the sidebar to get started.' : 'Select a lesson from the sidebar or create a new one.'}
              </p>
            </div>
          )}

          {/* Version History */}
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 mt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <RotateCcw className="w-5 h-5 text-gray-600 dark:text-gray-400 mr-2" />
                <p className="font-bold text-lg dark:text-white">Version History</p>
              </div>
              <button 
                onClick={() => setShowVersions(!showVersions)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold flex items-center"
              >
                {showVersions ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                {showVersions ? 'Hide' : 'Show'} All Versions
              </button>
            </div>

            <div className="space-y-3">
              {versions.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-2">No version history yet. Save the course to create versions.</p>
              ) : versions.slice(0, showVersions ? versions.length : 2).map((version) => (
                <div 
                  key={version.id}
                  className={`flex items-center justify-between p-4 rounded-xl transition-all ${
                    version.isCurrent 
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500 dark:border-blue-600' 
                      : 'bg-gray-50 dark:bg-gray-700/50 border-2 border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-1">
                      <p className="font-semibold dark:text-white">{version.name}</p>
                      {version.isCurrent && (
                        <span className="bg-blue-500 text-white px-2 py-0.5 rounded-full text-xs font-semibold">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{version.changes}</p>
                    <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400">
                      <span>{version.timestamp}</span>
                      <span>•</span>
                      <span>by {version.author}</span>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    {!version.isCurrent && (
                      <button 
                        onClick={() => handleRestoreVersion(version.id)}
                        className="px-4 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 border border-blue-600 dark:border-blue-500 rounded-lg font-semibold transition-all"
                      >
                        Restore
                      </button>
                    )}
                    <button type="button" onClick={() => handleDownloadVersion(version.id)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-all">
                      <Download className="w-5 h-5 text-gray-600 dark:text-gray-300" />
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
                  <input
                    ref={driveUploadInputRef}
                    type="file"
                    accept="video/*,.pdf,.doc,.docx"
                    className="hidden"
                    onChange={handleDriveUpload}
                  />
                  <button
                    type="button"
                    onClick={() => driveUploadInputRef.current?.click()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold flex items-center text-sm"
                  >
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
                        <button
                          type="button"
                          onClick={() => handleCopyDriveFileName(file.name)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Copy file name"
                        >
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
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
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
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
              >
                <X className="w-6 h-6 dark:text-gray-200" />
              </button>
            </div>

            <div className="p-6">
              {uploadProgress === 0 ? (
                <>
                  {/* Video link only (Upload file section hidden for this release) */}
                  <div className="mb-6">
                    <div className="border-2 border-dashed border-violet-200 dark:border-violet-800 rounded-xl p-6 mb-6 bg-violet-50/50 dark:bg-violet-900/10">
                      <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">Paste video link</label>
                      <input
                        type="url"
                        placeholder="YouTube, Google Drive, or any public video URL..."
                        value={unifiedVideoUrl}
                        onChange={(e) => setUnifiedVideoUrl(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
                      />
                      {unifiedVideoUrl.trim() && isNonVideoLink(unifiedVideoUrl) && (
                        <div className="mt-2 p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 flex items-start gap-2">
                          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-amber-800 dark:text-amber-200">
                            This doesn&apos;t look like a video link (e.g. Google Doc, Sheet, or Form). Use a YouTube video, Google Drive <strong>video file</strong> (drive.google.com/file/d/...), or another direct video URL.
                          </p>
                        </div>
                      )}
                      {unifiedVideoUrl.trim() && !isNonVideoLink(unifiedVideoUrl) && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                          Detected: {detectVideoLinkType(unifiedVideoUrl) === 'youtube'
                            ? 'YouTube'
                            : detectVideoLinkType(unifiedVideoUrl) === 'google_drive'
                              ? 'Google Drive'
                              : 'Video link (public streaming)'}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Works with YouTube, Google Drive video (share as &quot;Anyone with the link can view&quot;), or other public streaming URLs.
                      </p>
                    </div>
                  </div>

                  {/* Video preview and set start/end from current position (when link is valid) */}
                  {unifiedVideoUrl.trim() && detectVideoLinkType(unifiedVideoUrl) && (
                    <div key={detectVideoLinkType(unifiedVideoUrl) + (getGoogleDriveFileId(unifiedVideoUrl) || '') + (getYouTubeVideoId(unifiedVideoUrl) || '')} className="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 p-4 mb-6">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Preview — play the video and set start/end from current position</p>
                      <div className="aspect-video w-full max-w-2xl mx-auto rounded-lg overflow-hidden bg-black mb-3">
                        {detectVideoLinkType(unifiedVideoUrl) === 'youtube' && getYouTubeVideoId(unifiedVideoUrl) && (
                          <div id="create-course-yt-preview" className="w-full h-full" />
                        )}
                        {detectVideoLinkType(unifiedVideoUrl) === 'google_drive' && getGoogleDriveFileId(unifiedVideoUrl) && (
                          <>
                            {!drivePreviewError && (
                              <video
                                ref={drivePreviewVideoRef}
                                src={getDriveProxyVideoUrl(getGoogleDriveFileId(unifiedVideoUrl)!)}
                                controls
                                className="w-full h-full"
                                onCanPlay={() => { setDrivePreviewReady(true); setDrivePreviewError(false); }}
                                onError={() => { setDrivePreviewReady(false); setDrivePreviewError(true); }}
                              />
                            )}
                            {drivePreviewError && (
                              <iframe
                                title="Video preview (fallback)"
                                src={getGoogleDriveEmbedUrl(getGoogleDriveFileId(unifiedVideoUrl)!, parseHHMMSSToSeconds(startTime.trim()) ?? 0)}
                                className="w-full h-full"
                                allow="autoplay"
                                allowFullScreen
                              />
                            )}
                          </>
                        )}
                        {detectVideoLinkType(unifiedVideoUrl) === 'external_url' && (
                          isSharePointOrOneDriveVideoUrl(unifiedVideoUrl) ? (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-gray-100 p-4 text-center">
                              <p className="text-sm mb-3">SharePoint/OneDrive may block in-app embedding.</p>
                              <a
                                href={unifiedVideoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-medium"
                              >
                                Open link in new tab
                              </a>
                            </div>
                          ) : (
                            <video
                              ref={linkPreviewVideoRef}
                              src={unifiedVideoUrl}
                              controls
                              className="w-full h-full"
                              crossOrigin="anonymous"
                              onCanPlay={() => setExternalPreviewReady(true)}
                            />
                          )
                        )}
                      </div>
                      {detectVideoLinkType(unifiedVideoUrl) === 'google_drive' && drivePreviewReady && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">Current position: {drivePreviewCurrentTime}</p>
                      )}
                      <div className="flex flex-wrap gap-2 items-center">
                        <button
                          type="button"
                          onClick={() => {
                            const linkType = detectVideoLinkType(unifiedVideoUrl);
                            let sec: number | null = null;
                            if (linkType === 'youtube' && ytPreviewReady) {
                              const t = ytPreviewPlayerRef.current?.getCurrentTime?.();
                              if (typeof t === 'number' && t >= 0) sec = t;
                            } else if (linkType === 'external_url' && linkPreviewVideoRef.current) {
                              sec = linkPreviewVideoRef.current.currentTime;
                            } else if (linkType === 'google_drive' && drivePreviewReady) {
                              sec = parseHHMMSSToSeconds(drivePreviewCurrentTime);
                            }
                            if (sec != null) {
                              setStartTime(formatSecondsToHHMMSS(sec));
                              setStartTimeError(null);
                              const e = parseHHMMSSToSeconds(duration.trim());
                              if (e !== null && e <= sec) setEndTimeError('Must be after start');
                              else setEndTimeError(null);
                            }
                          }}
                          disabled={detectVideoLinkType(unifiedVideoUrl) === 'youtube' ? !ytPreviewReady : detectVideoLinkType(unifiedVideoUrl) === 'external_url' ? (isSharePointOrOneDriveVideoUrl(unifiedVideoUrl) ? false : !externalPreviewReady) : detectVideoLinkType(unifiedVideoUrl) === 'google_drive' ? !drivePreviewReady : true}
                          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-600 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Set start from current position
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const linkType = detectVideoLinkType(unifiedVideoUrl);
                            let sec: number | null = null;
                            if (linkType === 'youtube' && ytPreviewReady) {
                              const t = ytPreviewPlayerRef.current?.getCurrentTime?.();
                              if (typeof t === 'number' && t >= 0) sec = t;
                            } else if (linkType === 'external_url' && linkPreviewVideoRef.current) {
                              sec = linkPreviewVideoRef.current.currentTime;
                            } else if (linkType === 'google_drive' && drivePreviewReady) {
                              sec = parseHHMMSSToSeconds(drivePreviewCurrentTime);
                            }
                            if (sec != null) {
                              setDuration(formatSecondsToHHMMSS(sec));
                              setEndTimeError(null);
                              const s = parseHHMMSSToSeconds(startTime.trim());
                              if (s !== null && sec <= s) setStartTimeError('Start must be before end');
                              else setStartTimeError(null);
                            }
                          }}
                          disabled={detectVideoLinkType(unifiedVideoUrl) === 'youtube' ? !ytPreviewReady : detectVideoLinkType(unifiedVideoUrl) === 'external_url' ? (isSharePointOrOneDriveVideoUrl(unifiedVideoUrl) ? false : !externalPreviewReady) : detectVideoLinkType(unifiedVideoUrl) === 'google_drive' ? !drivePreviewReady : true}
                          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-violet-500 bg-violet-50 dark:bg-violet-900/20 dark:border-violet-600 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Set end from current position
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setStartTime('00:00:00');
                            setStartTimeError(null);
                            setEndTimeError(null);
                            const linkType = detectVideoLinkType(unifiedVideoUrl);
                            let endSec: number | null = null;
                            if (linkType === 'youtube' && ytPreviewReady && ytPreviewPlayerRef.current?.getDuration) {
                              const d = ytPreviewPlayerRef.current.getDuration();
                              if (typeof d === 'number' && d > 0) endSec = d;
                            } else if (linkType === 'external_url' && linkPreviewVideoRef.current && linkPreviewVideoRef.current.duration) {
                              endSec = linkPreviewVideoRef.current.duration;
                            } else if (linkType === 'google_drive' && drivePreviewReady && drivePreviewVideoRef.current?.duration) {
                              const d = drivePreviewVideoRef.current.duration;
                              if (Number.isFinite(d) && d > 0) endSec = d;
                            }
                            if (endSec != null) {
                              setDuration(formatSecondsToHHMMSS(endSec));
                            } else if (detectVideoLinkType(unifiedVideoUrl) === 'google_drive') {
                              setDuration('23:59:59');
                            } else {
                              setDuration('');
                            }
                          }}
                          disabled={detectVideoLinkType(unifiedVideoUrl) === 'youtube' ? !ytPreviewReady : detectVideoLinkType(unifiedVideoUrl) === 'external_url' ? (isSharePointOrOneDriveVideoUrl(unifiedVideoUrl) ? false : !externalPreviewReady) : false}
                          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-500 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Full video
                        </button>
                        {detectVideoLinkType(unifiedVideoUrl) === 'google_drive' && drivePreviewError && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">Set start/end manually below for Google Drive (preview fallback).</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Common Fields */}
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">Content Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g., Welcome & Overview"
                        value={segmentName}
                        onChange={(e) => setSegmentName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">Start Time</label>
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
                          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 dark:text-white dark:placeholder-gray-500 ${startTimeError ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Format: HH:MM:SS. Min: 00:00:00</p>
                        {startTimeError && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{startTimeError}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">End Time</label>
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
                            } else if (duration.trim() && e != null && s != null && e > s) setEndTimeError(null);
                            else setEndTimeError(null);
                          }}
                          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 dark:text-white dark:placeholder-gray-500 ${endTimeError ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Format: HH:MM:SS. Must be after start; max video length if set below.</p>
                        {endTimeError && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{endTimeError}</p>}
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">
                        Video length (total) (optional)
                      </label>
                      <input
                        type="text"
                        placeholder="00:10:00"
                        value={videoMaxDuration}
                        onChange={(e) => {
                          setVideoMaxDuration(e.target.value);
                          const eSec = parseHHMMSSToSeconds(duration.trim());
                          const m = parseHHMMSSToSeconds(e.target.value.trim());
                          const hasDuration = duration.trim().length > 0;
                          if (hasDuration && m != null && eSec != null) {
                            if (eSec > m) setEndTimeError('Cannot exceed video length');
                            else setEndTimeError(null);
                          }
                        }}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent max-w-xs bg-white dark:bg-gray-700 dark:text-white dark:placeholder-gray-500 border-gray-300 dark:border-gray-600"
                      />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        HH:MM:SS. If set, segment end time cannot exceed this. Duration is calculated from start and end when both are set.
                      </p>
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
                    <div className="flex items-start">
                      <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-blue-900 dark:text-blue-200">
                        <p className="font-semibold mb-1">Video Streaming</p>
                        <p>Videos will stream only the specified segment (between start and end times), reducing bandwidth usage. The video won&apos;t be fully downloaded before playback starts.</p>
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
                      className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 font-semibold transition-all text-gray-900 dark:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleContentUpload}
                      disabled={
                        (uploadType === 'link' &&
                          (!unifiedVideoUrl.trim() ||
                            isNonVideoLink(unifiedVideoUrl.trim()) ||
                            !detectVideoLinkType(unifiedVideoUrl.trim()))) ||
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
                      className="flex-1 px-6 py-3 bg-blue-600 dark:bg-blue-600 text-white rounded-xl dark:hover:bg-blue-700 font-semibold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {contentToReplace ? 'Replace Content' : 'Add Content'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-8">
                  <div className="text-center mb-6">
                    <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Upload className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h4 className="font-bold text-xl mb-2 text-gray-900 dark:text-white">Processing...</h4>
                    <p className="text-gray-600 dark:text-gray-400">Setting up your content</p>
                  </div>

                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-semibold text-gray-900 dark:text-white">Progress</span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300"
                        style={{width: `${uploadProgress}%`}}
                      ></div>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center text-gray-600 dark:text-gray-400">
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" />
                      <span>Content processed successfully</span>
                    </div>
                    <div className="flex items-center text-gray-600 dark:text-gray-400">
                      <div className="w-5 h-5 mr-2">
                        {uploadProgress >= 50 ? (
                          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                        ) : (
                          <div className="w-5 h-5 border-2 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                        )}
                      </div>
                      <span>Configuring streaming settings...</span>
                    </div>
                    <div className="flex items-center text-gray-400 dark:text-gray-500">
                      <div className="w-5 h-5 mr-2">
                        <div className="w-5 h-5 border-2 border-gray-300 dark:border-gray-600 rounded-full"></div>
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
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Add Reading Material</h3>
              <button
                onClick={() => { setShowReadingModal(false); setReadingTitle(''); setReadingUrl(''); setReadingBody(''); setReadingFormat('plain'); }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
              >
                <X className="w-6 h-6 dark:text-gray-200" />
              </button>
            </div>
            <div className="p-6">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
                <div className="flex items-start">
                  <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 mr-3 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-amber-900 dark:text-amber-200">
                    <p className="font-semibold mb-1">Reading options</p>
                    <p>Link to a Google Doc, Microsoft Office doc, or any public URL, or write content using the native text editor below.</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">Title</label>
                  <input
                    type="text"
                    value={readingTitle}
                    onChange={(e) => setReadingTitle(e.target.value)}
                    placeholder="e.g., Chapter 1 – Introduction"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">Type</label>
                  <div className="flex gap-4">
                    <label className="flex items-center cursor-pointer text-gray-900 dark:text-gray-200">
                      <input
                        type="radio"
                        name="readingType"
                        checked={readingType === 'url'}
                        onChange={() => setReadingType('url')}
                        className="mr-2"
                      />
                      <Link className="w-4 h-4 mr-1 text-amber-600 dark:text-amber-400" />
                      Link (Google Doc, Microsoft Doc, etc.)
                    </label>
                    <label className="flex items-center cursor-pointer text-gray-900 dark:text-gray-200">
                      <input
                        type="radio"
                        name="readingType"
                        checked={readingType === 'native'}
                        onChange={() => setReadingType('native')}
                        className="mr-2"
                      />
                      <FileText className="w-4 h-4 mr-1 text-gray-600 dark:text-gray-400" />
                      Native text editor
                    </label>
                  </div>
                </div>
                {readingType === 'url' && (
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">URL</label>
                    <input
                      type="url"
                      value={readingUrl}
                      onChange={(e) => setReadingUrl(e.target.value)}
                      placeholder="https://docs.google.com/... or https://... "
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
                    />
                  </div>
                )}
                {readingType === 'native' && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">Content format</label>
                      <div className="flex gap-4 mb-2">
                        <label className="flex items-center cursor-pointer text-gray-900 dark:text-gray-200">
                          <input type="radio" name="readingFormat" checked={readingFormat === 'plain'} onChange={() => setReadingFormat('plain')} className="mr-2" />
                          Plain text
                        </label>
                        <label className="flex items-center cursor-pointer text-gray-900 dark:text-gray-200">
                          <input type="radio" name="readingFormat" checked={readingFormat === 'markdown'} onChange={() => setReadingFormat('markdown')} className="mr-2" />
                          Markdown
                        </label>
                        <label className="flex items-center cursor-pointer text-gray-900 dark:text-gray-200">
                          <input type="radio" name="readingFormat" checked={readingFormat === 'html'} onChange={() => setReadingFormat('html')} className="mr-2" />
                          HTML
                        </label>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Plain text is shown as-is. Markdown uses Obsidian/Notion-style: **bold**, *italic*, ~~strikethrough~~, ==highlight==, [links](url), &gt; blockquotes, - [ ] task lists, tables, and code. HTML is sanitized and rendered (e.g. &lt;p&gt;, &lt;strong&gt;, &lt;a href&gt;, &lt;ul&gt;/&lt;li&gt;, &lt;table&gt;, &lt;blockquote&gt;). Inline CSS via the style attribute is supported.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">Content</label>
                      <textarea
                        value={readingBody}
                        onChange={(e) => setReadingBody(e.target.value)}
                        placeholder={readingFormat === 'markdown' ? '## Heading\n\n**Bold**, *italic*, ~~strikethrough~~, ==highlight==\n\n- [ ] Task\n- [x] Done\n\n> Blockquote\n\n| Col A | Col B |' : readingFormat === 'html' ? '<p>Paragraph</p>\n<ul><li>List item</li></ul>\n<blockquote>Quote</blockquote>\n<p><strong>Bold</strong> and <em>italic</em></p>\n<a href="https://...">Link</a>' : 'Write or paste your reading content here...'}
                        rows={10}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white dark:bg-gray-700 dark:text-white dark:placeholder-gray-500 font-mono text-sm"
                      />
                    </div>
                    {(readingFormat === 'markdown' || readingFormat === 'html') && (
                      <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 p-4">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Live preview — how learners will see it</p>
                        <div className="min-h-[120px] max-h-[280px] overflow-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 p-4 text-gray-800 dark:text-gray-200">
                          {readingBody.trim() ? (
                            <ReadingContentRenderer
                              body={readingBody}
                              format={readingFormat}
                              className="text-gray-800 dark:text-gray-200"
                            />
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500 italic">Enter content above to see the preview.</span>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => { setShowReadingModal(false); setReadingTitle(''); setReadingUrl(''); setReadingBody(''); setReadingFormat('plain'); }}
                  className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 font-semibold text-gray-900 dark:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddReading}
                  className="px-6 py-2 bg-amber-600 dark:bg-amber-600 text-white rounded-xl hover:bg-amber-700 dark:hover:bg-amber-700 font-semibold"
                >
                  Add Reading
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Google Form modal — survey or graded quiz */}
      {showGoogleFormModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Add Google Form</h3>
              <button
                onClick={resetGoogleFormModal}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
              >
                <X className="w-6 h-6 dark:text-gray-200" />
              </button>
            </div>
            <div className="p-6">
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4 mb-6">
                <div className="flex items-start">
                  <Info className="w-5 h-5 text-purple-600 dark:text-purple-400 mr-3 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-purple-900 dark:text-purple-200">
                    <p className="font-semibold mb-1">Paste a Google Form link</p>
                    <p>Choose <strong>Survey / feedback</strong> for forms with no scoring, or <strong>Graded quiz</strong> to set a passing score and optionally record results in Coursify.</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setGoogleFormKind('form')}
                      className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                        googleFormKind === 'form'
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                      }`}
                    >
                      Survey / feedback
                    </button>
                    <button
                      type="button"
                      onClick={() => setGoogleFormKind('quiz')}
                      className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                        googleFormKind === 'quiz'
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                      }`}
                    >
                      Graded quiz
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">Title</label>
                  <input
                    type="text"
                    value={quizModalTitle}
                    onChange={(e) => setQuizModalTitle(e.target.value)}
                    placeholder={googleFormKind === 'quiz' ? 'e.g., Introduction Quiz' : 'e.g., Feedback Form'}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">Google Form URL</label>
                  <input
                    type="url"
                    value={quizModalFormUrl}
                    onChange={(e) => setQuizModalFormUrl(e.target.value)}
                    placeholder="https://docs.google.com/forms/d/e/.../viewform"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
                  />
                </div>
                {googleFormKind === 'quiz' && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">Passing Score (%)</label>
                      <input
                        type="number"
                        value={quizModalPassingScore}
                        onChange={(e) => setQuizModalPassingScore(Number(e.target.value) || 70)}
                        placeholder="70"
                        min={0}
                        max={100}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
                      />
                    </div>
                    <div className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setQuizModalRecordScoresOpen((o) => !o)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Record scores in Coursify (optional)</span>
                        {quizModalRecordScoresOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                      </button>
                      {quizModalRecordScoresOpen && (
                        <div className="p-4 pt-0 border-t border-gray-200 dark:border-gray-600 bg-purple-50/30 dark:bg-purple-900/10 space-y-3">
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            To save each learner&apos;s score and pass/fail in Coursify: add a hidden field in your form, paste its entry ID below, then copy the script into your form&apos;s <strong>Extensions → Apps Script</strong> and add an <strong>On form submit</strong> trigger.
                          </p>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Hidden field entry ID</label>
                            <input
                              type="text"
                              value={quizModalFormEntryIdWebhook}
                              onChange={(e) => setQuizModalFormEntryIdWebhook(e.target.value)}
                              placeholder="From form pre-filled link: entry.XXXXX"
                              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              const script = getQuizWebhookScript(quizModalFormEntryIdWebhook.trim(), quizModalPassingScore);
                              try {
                                if (navigator.clipboard?.writeText) {
                                  await navigator.clipboard.writeText(script);
                                } else {
                                  const ta = document.createElement('textarea');
                                  ta.value = script;
                                  ta.style.position = 'fixed';
                                  ta.style.opacity = '0';
                                  document.body.appendChild(ta);
                                  ta.select();
                                  document.execCommand('copy');
                                  document.body.removeChild(ta);
                                }
                                setQuizModalScriptCopied(true);
                                setTimeout(() => setQuizModalScriptCopied(false), 2500);
                              } catch {
                                setQuizModalScriptCopied(false);
                              }
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                            {quizModalScriptCopied ? 'Copied!' : 'Copy Apps Script'}
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={resetGoogleFormModal}
                  className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 font-semibold transition-all text-gray-900 dark:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const url = quizModalFormUrl.trim();
                    if (!url) return;
                    const modules = [...courseData.modules];
                    const moduleItem = modules[currentModule];
                    const lesson = moduleItem.lessons[currentLesson];
                    if (googleFormKind === 'form') {
                      lesson.content.push({
                        id: Date.now(),
                        type: 'form',
                        order: lesson.content.length,
                        form: {
                          id: Date.now(),
                          title: quizModalTitle.trim() || 'Form',
                          formUrl: url,
                        },
                      });
                    } else {
                      lesson.content.push({
                        id: Date.now(),
                        type: 'quiz',
                        order: lesson.content.length,
                        quiz: {
                          id: Date.now(),
                          title: quizModalTitle.trim() || 'Quiz',
                          passingScore: Math.min(100, Math.max(0, Number(quizModalPassingScore) || 70)),
                          questions: [],
                          formUrl: url,
                          formEntryIdWebhook: quizModalFormEntryIdWebhook.trim() || undefined,
                        },
                      });
                    }
                    setCourseData({ ...courseData, modules });
                    setSelectedContent(lesson.content.length - 1);
                    resetGoogleFormModal();
                  }}
                  disabled={!quizModalFormUrl.trim()}
                  className="flex-1 px-6 py-3 bg-purple-600 dark:bg-purple-600 text-white rounded-xl hover:bg-purple-700 dark:hover:bg-purple-700 font-semibold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add to lesson
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

      <YouTubeImportPanel
        open={showYouTubeImport}
        onClose={() => setShowYouTubeImport(false)}
        onApply={handleYouTubeImportApply}
      />

      <SheetImportPanel
        open={showSheetImport}
        onClose={() => setShowSheetImport(false)}
        onSuccess={(courseId) => {
          if (onImportSuccess) onImportSuccess(courseId);
          else showSaveMessage('Course created. Reload the page to edit it.');
        }}
      />

      <CourseStructurePanel
        open={showStructurePanel}
        onClose={() => setShowStructurePanel(false)}
        modules={courseData.modules as StructureModule[]}
        onChange={handleStructureChange}
        onNavigate={handleStructureNavigate}
      />
      </div>
    </div>
  );
};

export default CreateCourse;
