'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { HelpCircle, ChevronDown, ChevronRight, Send, BookOpen, MessageSquare, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

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
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
    setError(null);
    const url = sessionMode === 'instructor' ? '/api/instructor/questions' : '/api/learning/my-questions';
    try {
      const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) {
        if (res.status === 401) setError('Sign in to view Q & A.');
        else if (res.status === 404) setThreads([]);
        else setError('Failed to load questions.');
        setThreads([]);
        return;
      }
      const data = await res.json();
      setThreads(Array.isArray(data.threads) ? data.threads : []);
    } catch {
      setError('Failed to load questions.');
      setThreads([]);
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Q & A</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">Sign in to see your questions and answers.</p>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-center">
          <HelpCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <p className="text-amber-800 dark:text-amber-200 font-medium">Sign in to view Q & A</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Q & A</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        {sessionMode === 'instructor'
          ? 'Questions from learners across your courses. Answer here or while editing the course.'
          : 'All questions you’ve asked and their answers. Add a follow-up to continue the thread.'}
      </p>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 dark:text-gray-400">Loading…</p>
      ) : threads.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <MessageSquare className="w-16 h-16 text-gray-300 dark:text-gray-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 font-medium">
            {sessionMode === 'instructor' ? 'No questions from learners yet' : 'No questions yet'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
            {sessionMode === 'instructor'
              ? 'When learners ask questions in a course, they’ll appear here.'
              : 'Ask a question from the Take Course page (open a lesson and click “Ask a question”).'}
          </p>
          {sessionMode === 'learner' && onStartCourse && (
            <button
              type="button"
              onClick={() => setCurrentView('courses')}
              className="mt-6 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
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
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId((id) => (id === thread.id ? null : thread.id))}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  )}
                  <BookOpen className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {thread.courseTitle ?? 'Course'} · {thread.lessonTitle ?? 'Lesson'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">{thread.question_text}</p>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {thread.followUps?.length ? `${(thread.followUps.length + 1)} messages` : '1 message'}
                  </span>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-4">
                    {/* Root Q & A */}
                    <div className="pl-2">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Question — {displayName(thread.askedByName, thread.asked_by)}
                      </p>
                      <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{thread.question_text}</p>
                      {thread.answer_text ? (
                        <div className="mt-3 pl-3 border-l-2 border-blue-400 dark:border-blue-500">
                          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                            Answer — {displayName(thread.answeredByName, thread.answered_by)}
                          </p>
                          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{thread.answer_text}</p>
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
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm resize-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleAnswer(thread.course_id, thread.id)}
                            disabled={answeringId === thread.id || !(answerText[thread.id] ?? '').trim()}
                            className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                          >
                            <Send className="w-3.5 h-3.5" />
                            {answeringId === thread.id ? 'Sending…' : 'Send answer'}
                          </button>
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mt-2">{rootCreated}</p>
                    </div>

                    {/* Follow-ups */}
                    {(thread.followUps ?? []).map((f) => (
                      <div key={f.id} className="pl-4 border-l-2 border-gray-200 dark:border-gray-600 space-y-1">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          Follow-up — {displayName(f.askedByName, f.asked_by)}
                        </p>
                        <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{f.question_text}</p>
                        {f.answer_text ? (
                          <div className="mt-2 pl-3 border-l-2 border-blue-400 dark:border-blue-500">
                            <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                              Answer — {displayName(f.answeredByName, f.answered_by)}
                            </p>
                            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{f.answer_text}</p>
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
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm resize-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleAnswer(f.course_id, f.id)}
                              disabled={answeringId === f.id || !(answerText[f.id] ?? '').trim()}
                              className="mt-1 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                            >
                              <Send className="w-3.5 h-3.5" />
                              {answeringId === f.id ? 'Sending…' : 'Send answer'}
                            </button>
                          </div>
                        )}
                        <p className="text-xs text-gray-400 mt-1">{new Date(f.created_at).toLocaleString()}</p>
                      </div>
                    ))}

                    {/* Add follow-up (learner only) */}
                    {sessionMode === 'learner' && (
                      <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                        <textarea
                          value={followUpText[thread.id] ?? ''}
                          onChange={(e) => setFollowUpText((prev) => ({ ...prev, [thread.id]: e.target.value }))}
                          placeholder="Add a follow-up question…"
                          rows={2}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm resize-none"
                          disabled={!!submittingId}
                        />
                        <button
                          type="button"
                          onClick={() => handleAddFollowUp(thread.course_id, thread.id)}
                          disabled={submittingId === thread.id || !(followUpText[thread.id] ?? '').trim()}
                          className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
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
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
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
