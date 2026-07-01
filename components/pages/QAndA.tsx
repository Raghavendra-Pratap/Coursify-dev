'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { HelpCircle, ChevronDown, ChevronRight, Send, BookOpen, MessageSquare, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchJsonCached, readClientCache, SHELL_CACHE_MS } from '@/lib/client-fetch-cache';
import {
  answerQuoteBorder,
  listCardIcon,
  listCardIconWrap,
  primaryBtn,
} from '@/components/ui/theme-classes';

export type QuestionRow = {
  id: string;
  course_id: string;
  lesson_id: string | null;
  parent_id?: string | null;
  asked_by: string;
  question_text: string;
  answer_text: string | null;
  answered_by: string | null;
  answered_at: string | null;
  created_at: string;
  courseTitle?: string;
  lessonTitle?: string;
  courseCreatorId?: string | null;
  askedByName?: string | null;
  answeredByName?: string | null;
};

export type Thread = QuestionRow & { followUps: QuestionRow[] };

interface QAndAProps {
  setCurrentView: (view: string) => void;
  sessionMode: 'learner' | 'instructor' | null;
  onStartCourse?: (courseId: string) => void;
}

export default function QAndA({ setCurrentView, sessionMode, onStartCourse }: QAndAProps) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const qaCacheKey = sessionMode === 'instructor' ? 'instructor:questions' : 'learning:my-questions';
  const initialQaCache = sessionMode ? readClientCache<{ threads?: Thread[] }>(qaCacheKey, SHELL_CACHE_MS) : null;
  const [threads, setThreads] = useState<Thread[]>(() => initialQaCache?.threads ?? []);
  const [loading, setLoading] = useState(() => (sessionMode ? initialQaCache == null : true));
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [followUpText, setFollowUpText] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState<Record<string, string>>({});
  const [answeringId, setAnsweringId] = useState<string | null>(null);

  const displayName = (name: string | null | undefined, fallbackId?: string | null) => {
    const n = (name ?? '').trim();
    if (n) return n;
    if (fallbackId && fallbackId.length >= 8) return `User ${fallbackId.slice(0, 8)}`;
    return 'Unknown user';
  };

  const fetchThreads = useCallback(async () => {
    if (!userId) return;
    const url = sessionMode === 'instructor' ? '/api/instructor/questions' : '/api/learning/my-questions';
    const cacheKey = sessionMode === 'instructor' ? 'instructor:questions' : 'learning:my-questions';
    const cached = readClientCache<{ threads?: Thread[] }>(cacheKey, SHELL_CACHE_MS);
    if (cached?.threads) {
      setThreads(cached.threads);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const { data } = await fetchJsonCached<{ threads?: Thread[] }>(cacheKey, url, { maxAgeMs: SHELL_CACHE_MS });
      setThreads(Array.isArray(data.threads) ? data.threads : []);
    } catch {
      if (!cached?.threads) {
        setError('Failed to load questions.');
        setThreads([]);
      }
    } finally {
      setLoading(false);
    }
  }, [userId, sessionMode]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  const handleAddFollowUp = async (courseId: string, parentId: string) => {
    const text = (followUpText[parentId] ?? '').trim();
    if (!text) return;
    setSubmittingId(parentId);
    try {
      const res = await fetch(`/api/learning/courses/${courseId}/questions`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_text: text, parent_id: parentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Failed to add follow-up');
        return;
      }
      setFollowUpText((prev) => ({ ...prev, [parentId]: '' }));
      await fetchThreads();
    } catch {
      setError('Failed to add follow-up');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleAnswer = async (courseId: string, questionId: string) => {
    const text = (answerText[questionId] ?? '').trim();
    setAnsweringId(questionId);
    try {
      const res = await fetch(`/api/learning/courses/${courseId}/questions/${questionId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer_text: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Failed to submit answer');
        return;
      }
      setAnswerText((prev) => ({ ...prev, [questionId]: '' }));
      await fetchThreads();
    } catch {
      setError('Failed to submit answer');
    } finally {
      setAnsweringId(null);
    }
  };

  const handleDeleteAnswer = async (courseId: string, questionId: string) => {
    setAnsweringId(questionId);
    try {
      const res = await fetch(`/api/learning/courses/${courseId}/questions/${questionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? 'Failed to delete answer');
        return;
      }
      await fetchThreads();
    } catch {
      setError('Failed to delete answer');
    } finally {
      setAnsweringId(null);
    }
  };

  if (!userId) {
    return (
      <div className="p-8 max-w-3xl">
        <h1 className="text-2xl font-semibold text-content mb-2">Q & A</h1>
        <p className="text-content-secondary mb-8">Sign in to see your questions and answers.</p>
        <div className="app-card rounded-lg p-6 text-center border border-warning/30 bg-warning-subtle">
          <HelpCircle className="w-12 h-12 text-warning mx-auto mb-3" />
          <p className="text-content font-medium">Sign in to view Q & A</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-semibold text-content mb-2">Q & A</h1>
      <p className="text-content-secondary mb-8">
        {sessionMode === 'instructor'
          ? 'Questions from learners across your courses. Answer here or while editing the course.'
          : 'All questions you’ve asked and their answers. Add a follow-up to continue the thread.'}
      </p>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-danger-subtle border border-danger/30 text-danger text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-content-muted">Loading…</p>
      ) : threads.length === 0 ? (
        <div className="app-card rounded-2xl p-12 text-center">
          <MessageSquare className="w-16 h-16 text-content-muted mx-auto mb-4 opacity-50" />
          <p className="text-content-secondary font-medium">
            {sessionMode === 'instructor' ? 'No questions from learners yet' : 'No questions yet'}
          </p>
          <p className="text-sm text-content-muted mt-1">
            {sessionMode === 'instructor'
              ? 'When learners ask questions in a course, they’ll appear here.'
              : 'Ask a question from the Take Course page (open a lesson and click “Ask a question”).'}
          </p>
          {sessionMode === 'learner' && onStartCourse && (
            <button
              type="button"
              onClick={() => setCurrentView('courses')}
              className={`mt-6 ${primaryBtn} c-btn-sm`}
            >
              Go to My learning
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {threads.map((thread) => {
            const isExpanded = expandedId === thread.id;
            const rootCreated = new Date(thread.created_at).toLocaleString();
            return (
              <div
                key={thread.id}
                className="app-card rounded-xl overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId((id) => (id === thread.id ? null : thread.id))}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-overlay/50 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-content-muted flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-content-muted flex-shrink-0" />
                  )}
                  <div className={`${listCardIconWrap} w-10 h-10`}>
                    <BookOpen className={`${listCardIcon} w-5 h-5`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-content truncate">
                      {thread.courseTitle ?? 'Course'} · {thread.lessonTitle ?? 'Lesson'}
                    </p>
                    <p className="text-sm text-content-muted truncate mt-0.5">{thread.question_text}</p>
                  </div>
                  <span className="text-xs text-content-muted flex-shrink-0">
                    {thread.followUps?.length ? `${(thread.followUps.length + 1)} messages` : '1 message'}
                  </span>
                </button>

                {isExpanded && (
                  <div className="border-t border-line p-4 space-y-4">
                    {/* Root Q & A */}
                    <div className="pl-2">
                      <p className="text-xs font-medium text-content-muted mb-1">
                        Question — {displayName(thread.askedByName, thread.asked_by)}
                      </p>
                      <p className="text-sm text-content whitespace-pre-wrap">{thread.question_text}</p>
                      {thread.answer_text ? (
                        <div className={`mt-3 pl-3 ${answerQuoteBorder}`}>
                          <p className="text-xs font-medium text-accent mb-1">
                            Answer — {displayName(thread.answeredByName, thread.answered_by)}
                          </p>
                          <p className="text-sm text-content-secondary whitespace-pre-wrap">{thread.answer_text}</p>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <span />
                            {sessionMode === 'instructor' && userId && thread.courseCreatorId === userId && (
                              <button
                                type="button"
                                onClick={() => handleDeleteAnswer(thread.course_id, thread.id)}
                                disabled={answeringId === thread.id}
                                className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-600 disabled:opacity-50"
                                title="Delete answer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                {answeringId === thread.id ? 'Deleting…' : 'Delete answer'}
                              </button>
                            )}
                          </div>
                        </div>
                      ) : sessionMode === 'instructor' && (
                        <div className="mt-3">
                          <textarea
                            value={answerText[thread.id] ?? ''}
                            onChange={(e) => setAnswerText((prev) => ({ ...prev, [thread.id]: e.target.value }))}
                            placeholder="Write your answer…"
                            rows={2}
                            className="w-full app-input text-sm resize-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleAnswer(thread.course_id, thread.id)}
                            disabled={answeringId === thread.id || !(answerText[thread.id] ?? '').trim()}
                            className={`mt-2 flex items-center gap-2 ${primaryBtn} c-btn-sm disabled:opacity-50`}
                          >
                            <Send className="w-3.5 h-3.5" />
                            {answeringId === thread.id ? 'Sending…' : 'Send answer'}
                          </button>
                        </div>
                      )}
                      <p className="text-xs text-content-muted mt-2">{rootCreated}</p>
                    </div>

                    {/* Follow-ups */}
                    {(thread.followUps ?? []).map((f) => (
                      <div key={f.id} className="pl-4 border-l-2 border-line space-y-1">
                        <p className="text-xs font-medium text-content-muted">
                          Follow-up — {displayName(f.askedByName, f.asked_by)}
                        </p>
                        <p className="text-sm text-content whitespace-pre-wrap">{f.question_text}</p>
                        {f.answer_text ? (
                          <div className={`mt-2 pl-3 ${answerQuoteBorder}`}>
                            <p className="text-xs font-medium text-accent mb-1">
                              Answer — {displayName(f.answeredByName, f.answered_by)}
                            </p>
                            <p className="text-sm text-content-secondary whitespace-pre-wrap">{f.answer_text}</p>
                            <div className="mt-1 flex items-center justify-between gap-2">
                              <span />
                              {sessionMode === 'instructor' && userId && f.courseCreatorId === userId && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAnswer(f.course_id, f.id)}
                                  disabled={answeringId === f.id}
                                  className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-600 disabled:opacity-50"
                                  title="Delete answer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  {answeringId === f.id ? 'Deleting…' : 'Delete answer'}
                                </button>
                              )}
                            </div>
                          </div>
                        ) : sessionMode === 'instructor' && (
                          <div className="mt-2">
                            <textarea
                              value={answerText[f.id] ?? ''}
                              onChange={(e) => setAnswerText((prev) => ({ ...prev, [f.id]: e.target.value }))}
                              placeholder="Write your answer…"
                              rows={2}
                              className="w-full app-input text-sm resize-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleAnswer(f.course_id, f.id)}
                              disabled={answeringId === f.id || !(answerText[f.id] ?? '').trim()}
                              className={`mt-1 flex items-center gap-2 ${primaryBtn} c-btn-sm disabled:opacity-50`}
                            >
                              <Send className="w-3.5 h-3.5" />
                              {answeringId === f.id ? 'Sending…' : 'Send answer'}
                            </button>
                          </div>
                        )}
                        <p className="text-xs text-content-muted mt-1">{new Date(f.created_at).toLocaleString()}</p>
                      </div>
                    ))}

                    {/* Add follow-up (learner only) */}
                    {sessionMode === 'learner' && (
                      <div className="pt-3 border-t border-line">
                        <textarea
                          value={followUpText[thread.id] ?? ''}
                          onChange={(e) => setFollowUpText((prev) => ({ ...prev, [thread.id]: e.target.value }))}
                          placeholder="Add a follow-up question…"
                          rows={2}
                          className="w-full app-input text-sm resize-none"
                          disabled={!!submittingId}
                        />
                        <button
                          type="button"
                          onClick={() => handleAddFollowUp(thread.course_id, thread.id)}
                          disabled={submittingId === thread.id || !(followUpText[thread.id] ?? '').trim()}
                          className={`mt-2 flex items-center gap-2 ${primaryBtn} c-btn-sm disabled:opacity-50`}
                        >
                          <Send className="w-3.5 h-3.5" />
                          {submittingId === thread.id ? 'Sending…' : 'Add follow-up'}
                        </button>
                      </div>
                    )}

                    {onStartCourse && (
                      <button
                        type="button"
                        onClick={() => onStartCourse(thread.course_id)}
                        className="text-sm text-accent hover:underline"
                      >
                        Open course →
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
