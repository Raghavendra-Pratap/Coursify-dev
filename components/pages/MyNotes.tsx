'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { StickyNote, BookOpen, ChevronRight, ArrowLeft } from 'lucide-react';
import { listCardBtn, listCardChevron, listCardIcon, listCardIconWrap, primaryBtn } from '@/components/ui/theme-classes';
import { useAuth } from '@/contexts/AuthContext';
import { fetchJsonCached, readClientCache, SHELL_CACHE_MS } from '@/lib/client-fetch-cache';

const NOTES_STORAGE_PREFIX = 'coursify_note_';
const NOTES_MANIFEST_KEY = 'coursify_notes_manifest';

type NoteEntry = {
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
  moduleId?: string;
  moduleTitle?: string;
  updatedAt: number;
};

interface MyNotesProps {
  setCurrentView: (view: string) => void;
  onStartCourse?: (courseId: string) => void;
  onOpenLesson?: (courseId: string, lessonId: string) => void;
}

export default function MyNotes({ setCurrentView, onStartCourse, onOpenLesson }: MyNotesProps) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [entries, setEntries] = useState<NoteEntry[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [noteContents, setNoteContents] = useState<Record<string, string>>({});
  const [courseExists, setCourseExists] = useState<boolean | null>(null);
  const [existingLessonIds, setExistingLessonIds] = useState<Set<string>>(new Set());
  const [notesLoading, setNotesLoading] = useState(() => {
    if (!userId) return false;
    return readClientCache(`learning:notes:${userId}`, SHELL_CACHE_MS) == null;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !userId) {
      setEntries([]);
      setNotesLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const cacheKey = `learning:notes:${userId}`;
      const cached = readClientCache<{ notes?: Array<{ course_id: string; course_title: string; lesson_id: string; lesson_title: string; module_id?: string; module_title?: string; updated_at: string; content?: string }> }>(cacheKey, SHELL_CACHE_MS);
      if (cached?.notes?.length) {
        applyNotes(cached.notes);
        setNotesLoading(false);
      } else {
        setNotesLoading(true);
      }
      try {
        const { data } = await fetchJsonCached<{ notes?: Array<{ course_id: string; course_title: string; lesson_id: string; lesson_title: string; module_id?: string; module_title?: string; updated_at: string; content?: string }> }>(cacheKey, '/api/learning/notes', { maxAgeMs: SHELL_CACHE_MS });
        if (cancelled) return;
        const notes = Array.isArray(data.notes) ? data.notes : [];
        if (notes.length > 0) {
          applyNotes(notes);
          setNotesLoading(false);
          return;
        }
      } catch {
        // fall through to local manifest
      }
      if (cancelled) return;
      try {
        const raw = localStorage.getItem(`${NOTES_MANIFEST_KEY}_${userId}`);
        const list: NoteEntry[] = raw ? JSON.parse(raw) : [];
        setEntries(Array.isArray(list) ? list : []);
      } catch {
        setEntries([]);
      } finally {
        if (!cancelled) setNotesLoading(false);
      }

      function applyNotes(notes: Array<{ course_id: string; course_title: string; lesson_id: string; lesson_title: string; module_id?: string; module_title?: string; updated_at: string; content?: string }>) {
        const mapped = notes.map((n) => ({
          courseId: n.course_id,
          courseTitle: n.course_title,
          lessonId: n.lesson_id,
          lessonTitle: n.lesson_title,
          moduleId: n.module_id,
          moduleTitle: n.module_title,
          updatedAt: new Date(n.updated_at).getTime(),
        }));
        setEntries(mapped);
        const contents: Record<string, string> = {};
        for (const n of notes) {
          const key = userId ? `${NOTES_STORAGE_PREFIX}${userId}_${n.course_id}_${n.lesson_id}` : null;
          if (key) contents[key] = n.content ?? '';
        }
        setNoteContents(contents);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const byCourse = useMemo(() => {
    const map = new Map<string, NoteEntry[]>();
    for (const e of entries) {
      const list = map.get(e.courseId) ?? [];
      list.push(e);
      map.set(e.courseId, list);
    }
    map.forEach((list) => {
      list.sort((a, b) => b.updatedAt - a.updatedAt);
    });
    return map;
  }, [entries]);

  const selectedCourseNotes = useMemo(() => {
    if (!selectedCourseId) return [];
    return (byCourse.get(selectedCourseId) ?? []).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [selectedCourseId, byCourse]);

  const selectedCourseTitle = useMemo(() => {
    if (!selectedCourseId) return '';
    const notes = byCourse.get(selectedCourseId);
    return notes?.[0]?.courseTitle ?? 'Course';
  }, [selectedCourseId, byCourse]);

  const storageKeyFor = useCallback((courseId: string, lessonId: string) => {
    return userId ? `${NOTES_STORAGE_PREFIX}${userId}_${courseId}_${lessonId}` : null;
  }, [userId]);

  useEffect(() => {
    if (!selectedCourseId) {
      setCourseExists(null);
      setExistingLessonIds(new Set());
      return;
    }
    let cancelled = false;
    setCourseExists(null);
    setExistingLessonIds(new Set());
    fetch(`/api/learning/courses/${selectedCourseId}/content`, { credentials: 'include', cache: 'no-store' })
      .then((res) => {
        if (cancelled) return res;
        if (!res.ok) {
          setCourseExists(false);
          return res;
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setCourseExists(true);
        const ids = new Set<string>();
        const mods = data?.modules ?? [];
        for (const m of mods) {
          const lessons = m?.lessons ?? [];
          for (const l of lessons) {
            if (l?.id) ids.add(l.id);
          }
        }
        setExistingLessonIds(ids);
      })
      .catch(() => {
        if (!cancelled) setCourseExists(false);
      });
    return () => { cancelled = true; };
  }, [selectedCourseId]);

  useEffect(() => {
    if (!userId || selectedCourseNotes.length === 0) return;
    const next: Record<string, string> = { ...noteContents };
    let changed = false;
    for (const entry of selectedCourseNotes) {
      const key = storageKeyFor(entry.courseId, entry.lessonId);
      if (key && next[key] === undefined) {
        try {
          next[key] = localStorage.getItem(key) ?? '';
          changed = true;
        } catch {
          next[key] = '';
          changed = true;
        }
      }
    }
    if (changed) setNoteContents(next);
  }, [userId, selectedCourseId, selectedCourseNotes.length, storageKeyFor]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!userId) {
    return (
      <div className="p-8 max-w-3xl">
        <h1 className="text-2xl font-semibold text-content mb-2">My Notes</h1>
        <p className="text-content-secondary mb-8">Sign in to see your notes from enrolled courses. Notes are stored locally and remain available even if a course is removed.</p>
        <div className="app-card rounded-lg p-6 text-center border border-warning/30 bg-warning-subtle">
          <StickyNote className="w-12 h-12 text-warning mx-auto mb-3" />
          <p className="text-content font-medium">Sign in to view your notes</p>
        </div>
      </div>
    );
  }

  if (selectedCourseId) {
    const notes = selectedCourseNotes;
    const courseTitle = selectedCourseTitle;
    const courseAvailable = courseExists === true;
    const lessonAvailable = (lessonId: string) => existingLessonIds.has(lessonId);

    return (
      <div className="p-8 max-w-4xl">
        <button
          type="button"
          onClick={() => setSelectedCourseId(null)}
          className="flex items-center gap-2 text-content-secondary hover:text-content font-medium mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to My Notes
        </button>
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-content">{courseTitle}</h1>
            <p className="text-sm text-content-secondary mt-0.5">
              One notebook per course · {notes.length} note{notes.length !== 1 ? 's' : ''}
            </p>
          </div>
          {!courseAvailable && (
            <span className="text-sm text-warning font-medium">Course no longer available</span>
          )}
          {courseAvailable && onStartCourse && (
            <button
              type="button"
              onClick={() => onStartCourse(selectedCourseId)}
              className="c-btn c-btn-primary c-btn-sm"
            >
              Open course
            </button>
          )}
        </div>

        {notes.length === 0 ? (
          <div className="app-card rounded-lg p-8 text-center">
            <p className="text-content-muted">No notes in this notebook.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {notes.map((entry) => {
              const sk = storageKeyFor(entry.courseId, entry.lessonId);
              const content = (sk && noteContents[sk]) ?? '';
              const lessonAvailableNow = lessonAvailable(entry.lessonId);
              const refLabel = [entry.moduleTitle, entry.lessonTitle].filter(Boolean).join(' · ') || entry.lessonTitle || 'Lesson';

              return (
                <article key={`${entry.courseId}:${entry.lessonId}`} className="app-card rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-line flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-content">{refLabel}</p>
                    <div className="flex items-center gap-2">
                      {!lessonAvailableNow && (
                        <span className="text-xs text-warning">Lesson no longer available</span>
                      )}
                      {courseAvailable && lessonAvailableNow && onOpenLesson && (
                        <button
                          type="button"
                          onClick={() => onOpenLesson(entry.courseId, entry.lessonId)}
                          className="text-sm text-accent hover:underline"
                        >
                          Open lesson →
                        </button>
                      )}
                      <span className="text-xs text-content-muted">
                        {new Date(entry.updatedAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="rounded-lg border border-line bg-raised p-3 text-sm text-content-secondary whitespace-pre-wrap min-h-[3rem]">
                      {content || <span className="text-content-muted italic">No note content</span>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-semibold text-content mb-2">My Notes</h1>
      <p className="text-content-secondary mb-8">
        All your notes from enrolled courses in one place. One notebook per course. Notes are stored locally and remain available even if a course is deleted.
      </p>

      {notesLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-raised animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="app-card rounded-lg p-12 text-center">
          <StickyNote className="w-16 h-16 text-content-muted mx-auto mb-4" />
          <p className="text-content font-medium">No notes yet</p>
          <p className="text-sm text-content-secondary mt-1">Take notes while taking a course — they’ll appear here as one notebook per course.</p>
          <button
            type="button"
            onClick={() => setCurrentView('courses')}
            className={`mt-6 ${primaryBtn} c-btn-sm`}
          >
            Go to My learning
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from(byCourse.entries()).map(([courseId, courseNotes]) => {
            const courseTitle = courseNotes[0]?.courseTitle ?? 'Course';
            const count = courseNotes.length;
            return (
              <button
                key={courseId}
                type="button"
                onClick={() => setSelectedCourseId(courseId)}
                className={listCardBtn}
              >
                <div className={listCardIconWrap}>
                  <BookOpen className={listCardIcon} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-content truncate">{courseTitle}</p>
                  <p className="text-sm text-content-secondary">{count} note{count !== 1 ? 's' : ''}</p>
                </div>
                <ChevronRight className={listCardChevron} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
