'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle,
  FileText,
  Video,
  HelpCircle,
  Lock,
  Circle,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  Moon,
  Sun,
  Maximize,
  Minimize,
  StickyNote,
  GripVertical,
  Send,
  X,
} from 'lucide-react';
import { LessonVideoPlayer, type VideoSegment } from '../LessonVideoPlayer';
import { ReadingContentRenderer } from '@/components/ReadingContentRenderer';
import { useAuth } from '@/contexts/AuthContext';

type Lesson = { id: string; title: string; description?: string | null; order_index: number };
type Module = { id: string; title: string; order_index: number; lessons: Lesson[] };
type ContentItem = {
  id: string;
  content_type: string;
  order_index: number;
  videoSegments?: (VideoSegment & { source?: string; duration_seconds?: number })[];
  readingMaterial?: { title: string; body?: string | null; url?: string | null; format?: string | null } | null;
  quiz?: { title: string; description?: string | null; form_url?: string | null; form_entry_id_webhook?: string | null } | null;
  form?: { title: string; description?: string | null; form_url?: string | null } | null;
};

type LessonStep =
  | { type: 'video'; segmentId: string; segment: VideoSegment & { source?: string; duration_seconds?: number }; stepLabel: string }
  | { type: 'reading'; item: ContentItem; stepLabel: string }
  | { type: 'quiz'; item: ContentItem; stepLabel: string }
  | { type: 'form'; item: ContentItem; stepLabel: string };

interface TakeCourseProps {
  courseId: string;
  onBack: () => void;
  sidebarOpen?: boolean;
  /** When provided, open directly to this lesson after course loads. */
  initialLessonId?: string | null;
}

const NOTES_STORAGE_PREFIX = 'coursify_note_';
const NOTES_MANIFEST_KEY = 'coursify_notes_manifest';
const DEFAULT_NOTES_WIDTH = 320;
const MIN_NOTES_WIDTH = 200;
const MAX_NOTES_WIDTH = 600;

/** Convert document/form URLs to embed-friendly format (Google Docs /preview, Google Forms embedded, etc.) */
function getEmbedUrl(url: string): string {
  const u = url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`;
  // Google Forms: use viewform?embedded=true for iframe
  const gformMatch = u.match(/docs\.google\.com\/forms\/d\/(?:e\/)?([a-zA-Z0-9_-]+)(?:\/.*)?/);
  if (gformMatch) {
    const formId = gformMatch[1];
    const isLongId = formId.length > 20; // /d/e/XXX has long hash
    const base = isLongId ? `https://docs.google.com/forms/d/e/${formId}/viewform` : `https://docs.google.com/forms/d/${formId}/viewform`;
    return base.includes('?') ? `${base}&embedded=true` : `${base}?embedded=true`;
  }
  // Google Docs: use /preview for embedding (works better than /edit)
  const gdocMatch = u.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)(?:\/edit|\/view)?/);
  if (gdocMatch) return `https://docs.google.com/document/d/${gdocMatch[1]}/preview`;
  // Google Sheets
  const gsheetMatch = u.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (gsheetMatch) return `https://docs.google.com/spreadsheets/d/${gsheetMatch[1]}/htmlembed`;
  // Microsoft Office: use Office Online viewer when possible
  if (/\.(docx?|xlsx?|pptx?)(\?|$)/i.test(u) || u.includes('office.com') || u.includes('onedrive')) {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(u)}`;
  }
  return u;
}

/** Renders quiz iframe; when entryId is set, fetches a one-time token and pre-fills the form hidden field for webhook scoring. */
function QuizEmbedWithWebhookToken({
  enrollmentId,
  contentItemId,
  formUrl,
  entryId,
  title,
}: {
  enrollmentId: string | null;
  contentItemId: string;
  formUrl: string;
  entryId?: string | null;
  title: string;
}) {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!entryId || !enrollmentId) {
      setEmbedUrl(getEmbedUrl(formUrl));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/learning/quiz-submit-token?enrollmentId=${encodeURIComponent(enrollmentId)}&contentItemId=${encodeURIComponent(contentItemId)}`,
          { credentials: 'include', cache: 'no-store' }
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled || !data?.token) return;
        const base = getEmbedUrl(formUrl);
        const sep = base.includes('?') ? '&' : '?';
        setEmbedUrl(`${base}${sep}entry.${entryId}=${encodeURIComponent(data.token)}`);
      } catch {
        if (!cancelled) setEmbedUrl(getEmbedUrl(formUrl));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enrollmentId, contentItemId, formUrl, entryId]);
  if (!embedUrl) {
    return (
      <div className="flex items-center justify-center p-8 text-gray-500 dark:text-gray-400">
        Loading quiz…
      </div>
    );
  }
  return (
    <iframe
      title={title}
      src={embedUrl}
      className="w-full h-full min-h-[60vh] border-0"
      allow="fullscreen"
      sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox"
    />
  );
}

function noteStorageKey(userId: string | null, courseId: string, lessonId: string): string | null {
  if (!userId) return null;
  return `${NOTES_STORAGE_PREFIX}${userId}_${courseId}_${lessonId}`;
}

export default function TakeCourse({ courseId, onBack, sidebarOpen = true, initialLessonId = null }: TakeCourseProps) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [course, setCourse] = useState<{ id: string; title: string; description?: string | null } | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(new Set());
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [lessonContent, setLessonContent] = useState<{ lesson: Lesson; contentItems: ContentItem[] } | null>(null);
  const [enrollmentIdForLesson, setEnrollmentIdForLesson] = useState<string | null>(null);
  const [quizStepEmbedUrl, setQuizStepEmbedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [completedSegments, setCompletedSegments] = useState<Set<string>>(new Set());
  const [submittingComplete, setSubmittingComplete] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [completeSuccess, setCompleteSuccess] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [sidebarPortalTarget, setSidebarPortalTarget] = useState<HTMLElement | null>(null);
  const [docZoom, setDocZoom] = useState(100);
  const [docDarkMode, setDocDarkMode] = useState(false);
  const [docFullScreen, setDocFullScreen] = useState(false);
  const docViewerRef = useRef<HTMLDivElement>(null);
  const [currentVideoProgress, setCurrentVideoProgress] = useState(0);
  const [currentVideoDurationSec, setCurrentVideoDurationSec] = useState(0);

  const [notesOpen, setNotesOpen] = useState(true);
  const [notesWidth, setNotesWidth] = useState(DEFAULT_NOTES_WIDTH);
  const [noteContent, setNoteContent] = useState('');
  const [resizingNotes, setResizingNotes] = useState(false);
  const noteSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [questionsPanelOpen, setQuestionsPanelOpen] = useState(false);
  const [questions, setQuestions] = useState<{ id: string; question_text: string; answer_text: string | null; answered_at: string | null; created_at: string }[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionInput, setQuestionInput] = useState('');
  const [questionSubmitting, setQuestionSubmitting] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);

  useEffect(() => {
    setSidebarPortalTarget(document.getElementById('take-course-sidebar-content'));
  }, []);

  useEffect(() => {
    const onFullScreenChange = () => {
      setDocFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullScreenChange);
  }, []);

  const loadCourse = useCallback(async () => {
    setLoading(true);
    try {
      const opts = { credentials: 'include' as RequestCredentials, cache: 'no-store' as RequestCache };
      const [contentRes] = await Promise.all([
        fetch(`/api/learning/courses/${courseId}/content`, opts),
        fetch(`/api/learning/courses/${courseId}/progress`, opts).catch(() => null),
      ]);
      if (!contentRes.ok) {
        setCourse(null);
        setModules([]);
        setCompletedLessonIds(new Set());
        return;
      }
      const data = await contentRes.json();
      setCourse(data.course ?? null);
      setModules(Array.isArray(data.modules) ? data.modules : []);
      setCompletedLessonIds(new Set(Array.isArray(data.completedLessonIds) ? data.completedLessonIds : []));
      const firstLesson = data.modules?.[0]?.lessons?.[0];
      if (firstLesson?.id) setSelectedLessonId(firstLesson.id);
      setExpandedModules(new Set((data.modules ?? []).map((m: { id: string }) => m.id)));
    } catch {
      setCourse(null);
      setModules([]);
      setCompletedLessonIds(new Set());
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadCourse();
  }, [loadCourse]);

  // Auto-select first lesson when course loads and none is selected; or open to initialLessonId when provided
  useEffect(() => {
    if (loading || modules.length === 0) return;
    if (initialLessonId) {
      const exists = modules.some((m) => m.lessons?.some((l: { id: string }) => l.id === initialLessonId));
      if (exists) {
        setSelectedLessonId(initialLessonId);
        return;
      }
    }
    if (selectedLessonId) return;
    const firstLesson = modules[0]?.lessons?.[0];
    if (firstLesson?.id) setSelectedLessonId(firstLesson.id);
  }, [loading, modules, selectedLessonId, initialLessonId]);

  useEffect(() => {
    if (!selectedLessonId) {
      setLessonContent(null);
      setCompletedSegments(new Set());
      return;
    }
    setCompleteError(null);
    setCompleteSuccess(false);
    const load = async () => {
      setContentLoading(true);
      setCompletedSegments(new Set());
      try {
        const res = await fetch(`/api/learning/courses/${courseId}/lessons/${selectedLessonId}`, {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!res.ok) {
          setLessonContent(null);
          return;
        }
        const data = await res.json();
        setLessonContent({ lesson: data.lesson, contentItems: data.contentItems ?? [] });
        setEnrollmentIdForLesson(typeof data.enrollmentId === 'string' ? data.enrollmentId : null);
      } catch {
        setLessonContent(null);
      } finally {
        setContentLoading(false);
      }
    };
    load();
  }, [courseId, selectedLessonId]);

  useEffect(() => {
    setCurrentStepIndex(0);
  }, [selectedLessonId, lessonContent?.contentItems?.length]);

  // Load note for current lesson from localStorage
  useEffect(() => {
    if (!userId || !courseId || !selectedLessonId) {
      setNoteContent('');
      return;
    }
    const key = noteStorageKey(userId, courseId, selectedLessonId);
    if (!key) return;
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
      setNoteContent(raw ?? '');
    } catch {
      setNoteContent('');
    }
  }, [userId, courseId, selectedLessonId]);

  // Debounced save of note + update manifest (so My Notes can list all notes; titles stored so notes survive course delete; module ref for notebook)
  const flushNoteSave = useCallback((
    uid: string | null,
    cid: string,
    lid: string,
    ctitle: string,
    ltitle: string,
    content: string,
    moduleId?: string | null,
    moduleTitle?: string | null
  ) => {
    if (!uid) return;
    const key = noteStorageKey(uid, cid, lid);
    if (!key || typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, content);
      const manifestKey = `${NOTES_MANIFEST_KEY}_${uid}`;
      const raw = localStorage.getItem(manifestKey);
      const entries: { courseId: string; courseTitle: string; lessonId: string; lessonTitle: string; moduleId?: string; moduleTitle?: string; updatedAt: number }[] = raw ? JSON.parse(raw) : [];
      const rest = entries.filter((e) => !(e.courseId === cid && e.lessonId === lid));
      rest.push({
        courseId: cid,
        courseTitle: ctitle,
        lessonId: lid,
        lessonTitle: ltitle,
        ...(moduleId != null && { moduleId: String(moduleId) }),
        ...(moduleTitle != null && moduleTitle !== '' && { moduleTitle: String(moduleTitle) }),
        updatedAt: Date.now(),
      });
      rest.sort((a, b) => b.updatedAt - a.updatedAt);
      localStorage.setItem(manifestKey, JSON.stringify(rest));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!userId || !courseId || !selectedLessonId || !course?.title) return;
    const key = noteStorageKey(userId, courseId, selectedLessonId);
    if (!key) return;
    const lessonTitle = lessonContent?.lesson?.title ?? 'Lesson';
    const content = noteContent;
    const currentModule = modules.find((m) => m.lessons?.some((l: { id: string }) => l.id === selectedLessonId));
    const moduleId = currentModule?.id ?? null;
    const moduleTitle = currentModule?.title ?? null;

    if (noteSaveTimeoutRef.current) clearTimeout(noteSaveTimeoutRef.current);
    noteSaveTimeoutRef.current = setTimeout(() => {
      noteSaveTimeoutRef.current = null;
      flushNoteSave(userId, courseId, selectedLessonId, course.title, lessonTitle, content, moduleId, moduleTitle);
    }, 500);
    return () => {
      if (noteSaveTimeoutRef.current) {
        clearTimeout(noteSaveTimeoutRef.current);
        noteSaveTimeoutRef.current = null;
        // Flush pending save when switching lesson so we don't lose the previous lesson's note
        flushNoteSave(userId, courseId, selectedLessonId, course.title, lessonTitle, content, moduleId, moduleTitle);
      }
    };
  }, [userId, courseId, selectedLessonId, course?.title, lessonContent?.lesson?.title, noteContent, modules, flushNoteSave]);

  // Resize notes panel: global mouse move/up when resizing
  useEffect(() => {
    if (!resizingNotes) return;
    const onMove = (e: MouseEvent) => {
      const container = document.querySelector('[data-take-course-layout]');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = rect.right - e.clientX;
      const w = Math.round(Math.min(MAX_NOTES_WIDTH, Math.max(MIN_NOTES_WIDTH, x)));
      setNotesWidth(w);
    };
    const onUp = () => setResizingNotes(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizingNotes]);

  // Reset progress display when switching to a different step so the bar doesn't show stale 100%
  useEffect(() => {
    setCurrentVideoProgress(0);
    setCurrentVideoDurationSec(0);
  }, [currentStepIndex]);

  // Fetch questions for current lesson when questions panel is open
  useEffect(() => {
    if (!questionsPanelOpen || !courseId || !selectedLessonId) {
      setQuestions([]);
      return;
    }
    let cancelled = false;
    setQuestionsLoading(true);
    setQuestionError(null);
    fetch(`/api/learning/courses/${courseId}/questions?lessonId=${encodeURIComponent(selectedLessonId)}`, { credentials: 'include', cache: 'no-store' })
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) throw new Error(res.status === 401 ? 'Sign in to view questions' : res.status === 403 ? 'Enrolled learners only' : 'Failed to load questions');
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setQuestions(Array.isArray(data.questions) ? data.questions : []);
      })
      .catch((err) => {
        if (!cancelled) setQuestionError(err instanceof Error ? err.message : 'Failed to load questions');
        if (!cancelled) setQuestions([]);
      })
      .finally(() => {
        if (!cancelled) setQuestionsLoading(false);
      });
    return () => { cancelled = true; };
  }, [questionsPanelOpen, courseId, selectedLessonId]);

  const submitQuestion = useCallback(async () => {
    const text = questionInput.trim();
    if (!text || !courseId || !selectedLessonId) return;
    setQuestionSubmitting(true);
    setQuestionError(null);
    try {
      const res = await fetch(`/api/learning/courses/${courseId}/questions`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_text: text, lesson_id: selectedLessonId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setQuestionError(data?.error ?? (res.status === 401 ? 'Sign in to ask a question' : 'Failed to submit'));
        return;
      }
      setQuestionInput('');
      setQuestions((prev) => (data.question ? [data.question, ...prev] : prev));
    } catch {
      setQuestionError('Failed to submit question');
    } finally {
      setQuestionSubmitting(false);
    }
  }, [courseId, selectedLessonId, questionInput]);

  const totalLessons = useMemo(
    () => modules.reduce((acc, m) => acc + (m.lessons?.length ?? 0), 0),
    [modules]
  );
  const completedCount = completedLessonIds.size;

  const requiredSegmentIds = useMemo(() => {
    if (!lessonContent) return [];
    const items = lessonContent.contentItems ?? [];
    const ids: string[] = [];
    for (const item of items) {
      if (item.content_type === 'video' && item.videoSegments?.length) {
        for (const seg of item.videoSegments) {
          if (seg?.id != null) ids.push(String(seg.id));
        }
      }
    }
    return ids;
  }, [lessonContent]);
  const hasVideoSegments = requiredSegmentIds.length > 0;
  const allSegmentsWatched = requiredSegmentIds.length > 0 && requiredSegmentIds.every((id) => completedSegments.has(id));
  const canCompleteLesson =
    completedLessonIds.has(selectedLessonId!)
      ? false
      : hasVideoSegments
        ? allSegmentsWatched
        : true;

  const onSegmentComplete = useCallback((segmentId: string) => {
    setCompletedSegments((prev) => new Set(prev).add(segmentId));
  }, []);

  // Auto-save lesson completion when all segments are watched (so course progress % updates without requiring the user to click "Complete lesson")
  const submittedLessonForSegmentsRef = useRef<string | null>(null);
  useEffect(() => {
    if (!hasVideoSegments || !allSegmentsWatched || !selectedLessonId || completedLessonIds.has(selectedLessonId)) return;
    if (submittedLessonForSegmentsRef.current === selectedLessonId) return;
    submittedLessonForSegmentsRef.current = selectedLessonId;
    (async () => {
      try {
        const res = await fetch(`/api/learning/courses/${courseId}/progress`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lessonId: selectedLessonId }),
        });
        if (res.ok) {
          setCompletedLessonIds((prev) => new Set(prev).add(selectedLessonId));
          setCompleteSuccess(true);
        }
      } catch {
        submittedLessonForSegmentsRef.current = null;
      }
    })();
  }, [courseId, selectedLessonId, hasVideoSegments, allSegmentsWatched, completedLessonIds]);

  const handleCompleteLesson = async () => {
    if (!selectedLessonId || !canCompleteLesson) return;
    setSubmittingComplete(true);
    setCompleteError(null);
    try {
      const res = await fetch(`/api/learning/courses/${courseId}/progress`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId: selectedLessonId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCompleteError(data.error || 'Failed to save completion');
        return;
      }
      setCompleteSuccess(true);
      setCompletedLessonIds((prev) => new Set(prev).add(selectedLessonId));
    } catch {
      setCompleteError('Network error');
    } finally {
      setSubmittingComplete(false);
    }
  };

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  /** Count steps in current lesson (video segments + reading/quiz/form items) */
  const currentLessonStepCount = (() => {
    const items = lessonContent?.contentItems ?? [];
    const sorted = [...items].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    let n = 0;
    for (const item of sorted) {
      if (item.content_type === 'video' && item.videoSegments?.length) n += item.videoSegments.length;
      else if (item.content_type === 'reading' && item.readingMaterial) n += 1;
      else if (item.content_type === 'quiz' && item.quiz) n += 1;
      else if (item.content_type === 'form') n += 1;
    }
    return n;
  })();

  /** Continue: next step in lesson → else next lesson → else next module's first lesson */
  const handleContinue = useCallback(() => {
    if (currentLessonStepCount > 0 && currentStepIndex < currentLessonStepCount - 1) {
      setCurrentStepIndex((i) => i + 1);
      return;
    }
    const orderedLessonIds = modules.flatMap((m) => (m.lessons ?? []).map((l) => l.id));
    const idx = selectedLessonId ? orderedLessonIds.indexOf(selectedLessonId) : -1;
    if (idx >= 0 && idx < orderedLessonIds.length - 1) {
      setSelectedLessonId(orderedLessonIds[idx + 1]);
      setCurrentStepIndex(0);
    }
  }, [currentLessonStepCount, currentStepIndex, modules, selectedLessonId]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-pulse text-gray-500 dark:text-gray-400">Loading course…</div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <p className="text-gray-600 dark:text-gray-400">Course not found or you’re not enrolled.</p>
        <button
          onClick={onBack}
          className="mt-4 flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Back to My learning
        </button>
      </div>
    );
  }

  const courseOutlineInSidebar = sidebarPortalTarget && (
    <div className="flex flex-col h-full min-h-0 text-white">
      <div className={`flex-shrink-0 border-b border-blue-500 flex items-center ${sidebarOpen ? 'p-4 gap-2' : 'p-2 justify-center'}`}>
        <BookOpen className="w-4 h-4 text-blue-200 flex-shrink-0" aria-hidden />
        {sidebarOpen && <h2 className="font-semibold">Course content</h2>}
      </div>
      <div className="overflow-y-auto flex-1 p-2">
        {modules.map((mod) => {
          const isExpanded = expandedModules.has(mod.id);
          const lessons = mod.lessons ?? [];
          return (
            <div key={mod.id} className="mb-1">
              <button
                onClick={() => toggleModule(mod.id)}
                className="w-full flex items-center gap-2 py-2.5 px-3 rounded-lg text-left text-sm font-medium text-white hover:bg-blue-500 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 flex-shrink-0 text-blue-200" />
                ) : (
                  <ChevronRight className="w-4 h-4 flex-shrink-0 text-blue-200" />
                )}
                <span className="truncate">{mod.title}</span>
                <span className="ml-auto text-xs text-blue-200">
                  {lessons.filter((l) => completedLessonIds.has(l.id)).length}/{lessons.length}
                </span>
              </button>
              {isExpanded && (
                <ul className="ml-4 mt-0.5 space-y-0.5">
                  {lessons.map((l) => {
                    const done = completedLessonIds.has(l.id);
                    const active = selectedLessonId === l.id;
                    return (
                      <li key={l.id}>
                        <button
                          onClick={() => setSelectedLessonId(l.id)}
                          className={`w-full flex items-center gap-2 py-2 px-3 rounded-lg text-left text-sm transition-colors ${
                            active ? 'bg-white text-blue-600 font-medium' : 'text-blue-100 hover:bg-blue-500'
                          }`}
                        >
                          {done ? (
                            <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-300" />
                          ) : (
                            <Circle className="w-4 h-4 flex-shrink-0 text-blue-200" />
                          )}
                          <span className="truncate">{l.title}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {sidebarPortalTarget && createPortal(courseOutlineInSidebar, sidebarPortalTarget)}
      <div className="h-full max-h-full flex flex-col min-h-0 min-w-0">
        {/* Top bar: back + course title + progress */}
        <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/95 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <button
                  onClick={onBack}
                  className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Back to My learning
                </button>
                <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 hidden sm:block" />
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate max-w-[200px] sm:max-w-none">
                  {course.title}
                </h1>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="flex-1 sm:flex-initial sm:min-w-[140px] h-2.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${totalLessons ? (completedCount / totalLessons) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  {completedCount} / {totalLessons} lessons
                </span>
              </div>
            </div>
          </div>
        </div>

        <div data-take-course-layout className="flex-1 min-h-0 flex w-full mx-auto px-4 sm:px-6 py-4 overflow-hidden">
          {/* Lesson area */}
          <main className="flex-1 min-h-0 min-w-0 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
          {contentLoading ? (
            <div className="flex-1 flex items-center justify-center p-8 text-gray-500 dark:text-gray-400">
              Loading lesson…
            </div>
          ) : lessonContent ? (
            <>
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{lessonContent.lesson?.title ?? 'Lesson'}</h2>
                    {lessonContent.lesson?.description && (
                      <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">{lessonContent.lesson.description}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuestionsPanelOpen(true)}
                    className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-500 dark:border-blue-400 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors text-sm font-medium"
                    aria-label="Ask a question"
                  >
                    <HelpCircle className="w-4 h-4" />
                    Ask a question
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-6 flex flex-col">
                {(lessonContent.contentItems ?? []).length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400">No content in this lesson yet.</p>
                ) : (() => {
                  const contentItems = lessonContent.contentItems ?? [];
                  const sortedItems = [...contentItems].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
                  const steps: LessonStep[] = [];
                  let stepNum = 0;
                  for (const item of sortedItems) {
                    if (item.content_type === 'video' && item.videoSegments?.length) {
                      for (const seg of item.videoSegments) {
                        if (seg == null) continue;
                        const segId = seg.id != null ? String(seg.id) : `seg-${stepNum}`;
                        stepNum += 1;
                        const segAny = seg as Record<string, unknown>;
                        steps.push({
                          type: 'video',
                          segmentId: segId,
                          segment: {
                            id: segId,
                            name: String(seg.name ?? 'Video'),
                            source: (seg.source ?? segAny.source) as string | undefined,
                            source_url: (seg.source_url ?? segAny.sourceUrl ?? segAny.video_url) as string | null | undefined,
                            storage_path: (seg.storage_path ?? segAny.storage_path) as string | null | undefined,
                            start_time_seconds: seg.start_time_seconds ?? (segAny.start_time_seconds as number | undefined),
                            end_time_seconds: seg.end_time_seconds ?? (segAny.end_time_seconds as number | undefined),
                            duration_seconds: seg.duration_seconds ?? (segAny.duration_seconds as number | undefined),
                          },
                          stepLabel: `Segment ${stepNum}`,
                        });
                      }
                    } else if (item.content_type === 'reading' && item.readingMaterial) {
                      stepNum += 1;
                      steps.push({ type: 'reading', item, stepLabel: `Reading: ${item.readingMaterial?.title ?? 'Reading'}` });
                    } else if (item.content_type === 'quiz' && item.quiz) {
                      stepNum += 1;
                      steps.push({ type: 'quiz', item, stepLabel: `Quiz: ${item.quiz?.title ?? 'Quiz'}` });
                    } else if (item.content_type === 'form' && item.form) {
                      stepNum += 1;
                      steps.push({ type: 'form', item, stepLabel: `Form: ${item.form?.title ?? 'Form'}` });
                    }
                  }
                  const totalSteps = steps.length;
                  const step = steps[currentStepIndex];
                  const isLastStep = currentStepIndex >= totalSteps - 1;
                  const totalLessonDurationSec = steps.reduce((acc, s) => {
                    if (s.type !== 'video') return acc;
                    const seg = s.segment;
                    const start = seg.start_time_seconds ?? 0;
                    const end = seg.end_time_seconds ?? undefined;
                    const dur = seg.duration_seconds;
                    const segmentSec = end != null && end > start ? end - start : (dur != null ? dur : 0);
                    return acc + Math.max(0, segmentSec);
                  }, 0);

                  return (
                    <div className="flex flex-col gap-4 flex-1 min-h-0">
                      <div className="flex items-center justify-between flex-shrink-0">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Watch each part to complete this lesson. You cannot skip ahead.
                        </p>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Step {Math.min(currentStepIndex + 1, totalSteps)} of {totalSteps}
                        </span>
                      </div>
                      <div className="rounded-xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex-1 min-h-0 flex flex-col shadow-sm">
                        {!step ? null : step.type === 'video' ? (
                          <div className="flex flex-col flex-1 min-h-0">
                            {/* Dark video area: 16:9 player fills available width and scales with window */}
                            <div className="flex-1 min-h-0 flex items-center justify-center p-2 sm:p-4 overflow-hidden bg-gray-900 dark:bg-black">
                              <div className="aspect-video w-full max-w-full rounded-lg overflow-hidden bg-black shrink-0 select-none max-h-[calc(100vh-12rem)]">
                                <LessonVideoPlayer
                                  segment={step.segment}
                                  onSegmentComplete={() => {
                                    onSegmentComplete(String(step.segmentId));
                                    if (!isLastStep) setCurrentStepIndex((i) => Math.min(i + 1, totalSteps - 1));
                                  }}
                                  completionThreshold={0.95}
                                  onProgress={(progress, durationSec) => {
                                    setCurrentVideoProgress(progress);
                                    setCurrentVideoDurationSec(durationSec);
                                  }}
                                />
                              </div>
                            </div>
                            {/* Bottom bar: title left, total lesson duration right */}
                            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-gray-900 dark:bg-gray-950 border-t border-gray-700">
                              <span className="text-sm font-medium text-white">
                                {step.segment.name}
                              </span>
                              <span className="text-sm text-white/90 tabular-nums">
                                {totalLessonDurationSec >= 60
                                  ? `${Math.ceil(totalLessonDurationSec / 60)} min`
                                  : `${Math.round(totalLessonDurationSec)} sec`}
                              </span>
                            </div>
                            {/* Segmented progress bar: blue (completed/current), white (remaining), grey (upcoming) with gaps */}
                            <div className="flex-shrink-0 px-4 pb-3">
                              <div className="flex gap-1 w-full h-2.5 rounded-full overflow-hidden">
                                {Array.from({ length: totalSteps }).map((_, i) => {
                                  const isCompleted = i < currentStepIndex;
                                  const isCurrent = i === currentStepIndex;
                                  const fillPct = isCurrent ? Math.min(1, Math.max(0, currentVideoProgress)) * 100 : isCompleted ? 100 : 0;
                                  return (
                                    <div
                                      key={i}
                                      className="h-full rounded-full overflow-hidden flex-1 min-w-0 flex bg-gray-600 dark:bg-gray-600"
                                    >
                                      <div
                                        className="h-full bg-blue-500 transition-all duration-150 shrink-0"
                                        style={{ width: `${fillPct}%` }}
                                      />
                                      <div
                                        className={`h-full flex-1 min-w-0 ${isCompleted ? 'bg-blue-500' : isCurrent ? 'bg-white/20' : 'bg-gray-600 dark:bg-gray-600'}`}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                              {completedSegments.has(step.segmentId) && (
                                <p className="text-xs text-emerald-400 mt-1.5 flex items-center gap-1">
                                  <CheckCircle className="w-3.5 h-3.5" /> Watched
                                </p>
                              )}
                            </div>
                          </div>
                        ) : step.type === 'reading' ? (
                          <div className="flex flex-col flex-1 min-h-0">
                            {/* Same header layout as video: document title on left, controls + Continue on right */}
                            <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-wrap">
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-amber-600 flex-shrink-0" />
                                {step.item.readingMaterial?.title ?? 'Reading'}
                              </span>
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="flex items-center gap-0.5 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 p-0.5">
                                  <button
                                    type="button"
                                    onClick={() => setDocZoom((z) => Math.max(50, Math.min(150, z - 10)))}
                                    className="p-1.5 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                                    title="Zoom out"
                                    aria-label="Zoom out"
                                  >
                                    <ZoomOut className="w-4 h-4" />
                                  </button>
                                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[2.25rem] text-center">{docZoom}%</span>
                                  <button
                                    type="button"
                                    onClick={() => setDocZoom((z) => Math.max(50, Math.min(150, z + 10)))}
                                    className="p-1.5 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                                    title="Zoom in"
                                    aria-label="Zoom in"
                                  >
                                    <ZoomIn className="w-4 h-4" />
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setDocDarkMode((d) => !d)}
                                  className="p-1.5 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                                  title={docDarkMode ? 'Light mode' : 'Dark mode'}
                                  aria-label={docDarkMode ? 'Light mode' : 'Dark mode'}
                                >
                                  {docDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (document.fullscreenElement) document.exitFullscreen();
                                    else docViewerRef.current?.requestFullscreen();
                                  }}
                                  className="p-1.5 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                                  title={docFullScreen ? 'Exit full screen' : 'Full screen'}
                                  aria-label={docFullScreen ? 'Exit full screen' : 'Full screen'}
                                >
                                  {docFullScreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={handleContinue}
                                  className="ml-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                                >
                                  Continue
                                </button>
                              </div>
                            </div>
                            {/* Full area for document (same as video area) */}
                            <div
                              ref={docViewerRef}
                              className="relative flex-1 min-h-0 flex flex-col overflow-auto bg-white dark:bg-gray-900 select-none"
                              style={{ zoom: docZoom / 100 }}
                            >
                              {docFullScreen && (
                                <button
                                  type="button"
                                  onClick={() => document.exitFullscreen()}
                                  className="absolute top-2 right-2 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/70 text-white text-sm hover:bg-black/85"
                                  aria-label="Exit full screen"
                                >
                                  <Minimize className="w-4 h-4" /> Exit full screen
                                </button>
                              )}
                              {step.item.readingMaterial?.url ? (
                                <div
                                  className="flex-1 min-h-0 flex flex-col w-full h-full"
                                  style={docDarkMode ? { filter: 'invert(1) hue-rotate(180deg)' } : undefined}
                                >
                                  <iframe
                                    title={step.item.readingMaterial?.title ?? 'Document'}
                                    src={getEmbedUrl(step.item.readingMaterial.url)}
                                    className="w-full h-full min-h-0 flex-1 border-0 bg-white"
                                    allow="fullscreen"
                                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox"
                                  />
                                </div>
                              ) : step.item.readingMaterial?.body ? (
                                <div
                                  className={`flex-1 p-6 min-h-0 overflow-auto ${docDarkMode ? 'bg-gray-900 text-gray-100' : ''}`}
                                >
                                  <ReadingContentRenderer
                                    body={step.item.readingMaterial.body}
                                    format={(step.item.readingMaterial.format as 'plain' | 'markdown' | 'html') ?? 'plain'}
                                    className={docDarkMode ? 'text-gray-100 prose-invert' : 'text-gray-700 dark:text-gray-300 dark:prose-invert'}
                                  />
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ) : step.type === 'quiz' ? (
                          (step.item.quiz?.form_url) ? (
                            <div className="flex flex-col flex-1 min-h-0">
                              <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                  <HelpCircle className="w-4 h-4 text-purple-600 flex-shrink-0" />
                                  {step.item.quiz?.title ?? 'Quiz'}
                                </span>
                                <button type="button" onClick={handleContinue} className="ml-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">Continue</button>
                              </div>
                              <div className="flex-1 min-h-0 overflow-auto bg-white dark:bg-gray-900">
                                {step.item.quiz.form_entry_id_webhook ? (
                                  <QuizEmbedWithWebhookToken
                                    enrollmentId={enrollmentIdForLesson}
                                    contentItemId={step.item.id}
                                    formUrl={step.item.quiz.form_url}
                                    entryId={step.item.quiz.form_entry_id_webhook}
                                    title={step.item.quiz?.title ?? 'Quiz'}
                                  />
                                ) : (
                                  <iframe
                                    title={step.item.quiz?.title ?? 'Quiz'}
                                    src={getEmbedUrl(step.item.quiz.form_url)}
                                    className="w-full h-full min-h-[60vh] border-0"
                                    allow="fullscreen"
                                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox"
                                  />
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col flex-1 p-6 overflow-y-auto">
                              <div className="flex items-center gap-2 mb-4">
                                <HelpCircle className="w-5 h-5 text-purple-600 flex-shrink-0" />
                                <h3 className="font-semibold text-gray-900 dark:text-white">{step.item.quiz?.title ?? 'Quiz'}</h3>
                              </div>
                              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">No quiz link configured.</p>
                              <button type="button" onClick={handleContinue} className="self-start px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">Continue</button>
                            </div>
                          )
                        ) : step.type === 'form' ? (
                          (step.item.form?.form_url) ? (
                            <div className="flex flex-col flex-1 min-h-0">
                              <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-green-600 flex-shrink-0" />
                                  {step.item.form?.title ?? 'Form'}
                                </span>
                                <button type="button" onClick={handleContinue} className="ml-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">Continue</button>
                              </div>
                              <div className="flex-1 min-h-0 overflow-auto bg-white dark:bg-gray-900">
                                <iframe
                                  title={step.item.form?.title ?? 'Form'}
                                  src={getEmbedUrl(step.item.form.form_url)}
                                  className="w-full h-full min-h-[60vh] border-0"
                                  allow="fullscreen"
                                  sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col flex-1 p-6 overflow-y-auto">
                              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">No form link configured.</p>
                              <button type="button" onClick={handleContinue} className="self-start px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">Continue</button>
                            </div>
                          )
                        ) : null}
                      </div>
                      {totalSteps > 1 && (
                        <div className="flex items-center justify-between flex-shrink-0 pt-2">
                          <button
                            type="button"
                            onClick={() => setCurrentStepIndex((i) => Math.max(0, i - 1))}
                            disabled={currentStepIndex === 0}
                            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 disabled:pointer-events-none"
                          >
                            ← Previous
                          </button>
                          <button
                            type="button"
                            onClick={() => setCurrentStepIndex((i) => Math.min(totalSteps - 1, i + 1))}
                            disabled={
                              currentStepIndex >= totalSteps - 1 ||
                              (step?.type === 'video' &&
                                step &&
                                !completedSegments.has(step.segmentId) &&
                                !completedLessonIds.has(selectedLessonId!))
                            }
                            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 disabled:pointer-events-none"
                          >
                            Next →
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Complete lesson section */}
                {!(lessonContent.contentItems ?? []).length ? null : completedLessonIds.has(selectedLessonId!) ? (
                  <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle className="w-6 h-6 text-emerald-500 flex-shrink-0" />
                    <span className="font-medium text-emerald-800 dark:text-emerald-200">This lesson is completed.</span>
                  </div>
                ) : (
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      {hasVideoSegments && !allSegmentsWatched && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm flex-1 min-w-0">
                          <Lock className="w-4 h-4 flex-shrink-0" />
                          <span>
                            Watch all {requiredSegmentIds.length} video segment{requiredSegmentIds.length !== 1 ? 's' : ''} to
                            the end to complete this lesson.
                          </span>
                          <span className="font-medium whitespace-nowrap">
                            ({completedSegments.size}/{requiredSegmentIds.length} watched)
                          </span>
                        </div>
                      )}
                      <button
                        onClick={handleCompleteLesson}
                        disabled={!canCompleteLesson || submittingComplete}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg disabled:shadow-none flex-shrink-0"
                      >
                        <CheckCircle className="w-5 h-5" />
                        {submittingComplete ? 'Saving…' : canCompleteLesson ? 'Complete lesson' : 'Watch all segments to complete'}
                      </button>
                    </div>
                    {completeError && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {completeError}
                      </div>
                    )}
                    {completeSuccess && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm">
                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                        Lesson marked complete.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-12 text-center text-gray-500 dark:text-gray-400">
              <div>
                <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                <p>Select a lesson from the sidebar to start.</p>
              </div>
            </div>
          )}
        </main>

        {/* Resizable Notes sidebar */}
        {notesOpen ? (
          <>
            <div
              role="separator"
              aria-label="Resize notes panel"
              onMouseDown={(e) => { e.preventDefault(); setResizingNotes(true); }}
              className="flex-shrink-0 w-1 cursor-col-resize hover:bg-blue-400 dark:hover:bg-blue-600 transition-colors rounded mx-0.5 self-stretch flex items-center justify-center group"
            >
              <div className="w-0.5 h-8 rounded-full bg-gray-300 dark:bg-gray-600 group-hover:bg-blue-500 dark:group-hover:bg-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <aside
              className="flex-shrink-0 flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
              style={{ width: notesWidth }}
            >
              <div className="flex items-center justify-between flex-shrink-0 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                  <StickyNote className="w-4 h-4 text-amber-500" />
                  Notes
                </span>
                <button
                  type="button"
                  onClick={() => setNotesOpen(false)}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                  aria-label="Close notes"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col p-2">
                {userId ? (
                  <textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Your notes for this lesson…"
                    className="w-full h-full min-h-[8rem] p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 text-sm"
                  />
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 p-3">Sign in to save notes.</p>
                )}
              </div>
            </aside>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setNotesOpen(true)}
            className="flex-shrink-0 flex flex-col items-center justify-center w-9 rounded-r-lg border border-l-0 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 py-2"
            title="Open notes"
            aria-label="Open notes"
          >
            <StickyNote className="w-5 h-5" />
            <span className="text-[10px] font-medium mt-0.5">Notes</span>
          </button>
        )}

        {/* Questions panel overlay */}
        {questionsPanelOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/40 z-40"
              aria-hidden
              onClick={() => setQuestionsPanelOpen(false)}
            />
            <div
              className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-xl z-50 flex flex-col"
              role="dialog"
              aria-label="Questions for this lesson"
            >
              <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-blue-500" />
                  Questions
                </h3>
                <button
                  type="button"
                  onClick={() => setQuestionsPanelOpen(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Ask the course creator or a collaborator. Your question is tied to this lesson.
                </p>
                <div>
                  <label htmlFor="take-course-question-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Your question or concern
                  </label>
                  <textarea
                    id="take-course-question-input"
                    value={questionInput}
                    onChange={(e) => setQuestionInput(e.target.value)}
                    placeholder="Type your question…"
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
                    disabled={questionSubmitting}
                  />
                  <button
                    type="button"
                    onClick={submitQuestion}
                    disabled={questionSubmitting || !questionInput.trim()}
                    className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <Send className="w-4 h-4" />
                    {questionSubmitting ? 'Sending…' : 'Send question'}
                  </button>
                </div>
                {questionError && (
                  <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {questionError}
                  </p>
                )}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Questions for this lesson</h4>
                  {questionsLoading ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
                  ) : questions.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No questions yet. Ask the first one above.</p>
                  ) : (
                    <ul className="space-y-3">
                      {questions.map((q) => (
                        <li key={q.id} className="rounded-lg border border-gray-200 dark:border-gray-600 p-3 bg-gray-50 dark:bg-gray-900/50">
                          <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{q.question_text}</p>
                          {q.answer_text ? (
                            <div className="mt-2 pl-2 border-l-2 border-blue-400 dark:border-blue-500">
                              <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-0.5">Answer from creator</p>
                              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{q.answer_text}</p>
                            </div>
                          ) : (
                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic">No answer yet.</p>
                          )}
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            {new Date(q.created_at).toLocaleString()}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
        </div>
      </div>
    </>
  );
}
