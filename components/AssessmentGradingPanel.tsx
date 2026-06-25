'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Award, CheckCircle, Loader2 } from 'lucide-react';

type PendingResponse = {
  id: string;
  question_id: string;
  question_type: string;
  answer: unknown;
  auto_score: number | null;
  max_score: number | null;
  needs_manual_grade: boolean;
  manual_score: number | null;
};

type PendingItem = {
  sessionId: string;
  contentItemId: string;
  assessmentTitle: string;
  passingScore: number;
  autoScore: number | null;
  learnerEmail: string | null;
  learnerName: string | null;
  submittedAt: string;
  responses: PendingResponse[];
};

interface AssessmentGradingPanelProps {
  courseId: string | null;
}

export function AssessmentGradingPanel({ courseId }: AssessmentGradingPanelProps) {
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, Record<string, string>>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  const loadPending = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/instructor/courses/${courseId}/assessments/pending-grades`, {
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? 'Failed to load pending grades');
        setPending([]);
        return;
      }
      setPending((data as { pending?: PendingItem[] }).pending ?? []);
    } catch {
      setError('Failed to load pending grades');
      setPending([]);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void loadPending();
  }, [loadPending]);

  const handleGrade = async (item: PendingItem) => {
    setSubmitting(item.sessionId);
    setError(null);
    try {
      const responseScores = scores[item.sessionId] ?? {};
      const responses = item.responses
        .filter((r) => responseScores[r.question_id]?.trim())
        .map((r) => ({
          questionId: r.question_id,
          manualScore: Number(responseScores[r.question_id]),
        }))
        .filter((r) => Number.isFinite(r.manualScore));

      const res = await fetch(`/api/instructor/assessments/sessions/${item.sessionId}/grade`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? 'Grading failed');
        return;
      }
      setSuccessId(item.sessionId);
      setPending((prev) => prev.filter((p) => p.sessionId !== item.sessionId));
      setTimeout(() => setSuccessId(null), 2500);
    } catch {
      setError('Grading failed');
    } finally {
      setSubmitting(null);
    }
  };

  if (!courseId) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 p-6 mb-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Assessment grading queue</h3>
        </div>
        <button
          type="button"
          onClick={() => void loadPending()}
          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
        >
          Refresh
        </button>
      </div>

      {loading && (
        <p className="text-sm text-gray-500 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </p>
      )}
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {!loading && pending.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">No submissions awaiting manual grading.</p>
      )}

      <div className="space-y-4">
        {pending.map((item) => (
          <div key={item.sessionId} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{item.assessmentTitle}</p>
                <p className="text-xs text-gray-500">
                  {item.learnerName || item.learnerEmail || 'Learner'} · submitted {new Date(item.submittedAt).toLocaleString()}
                </p>
                {item.autoScore != null && (
                  <p className="text-xs text-gray-500 mt-1">Auto score: {item.autoScore}% · Pass threshold: {item.passingScore}%</p>
                )}
              </div>
              {successId === item.sessionId && (
                <span className="text-xs text-emerald-600 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Graded
                </span>
              )}
            </div>

            {item.responses.length > 0 ? (
              <div className="space-y-3 mb-4">
                {item.responses.map((r) => (
                  <div key={r.id} className="rounded-lg bg-gray-50 dark:bg-gray-900/40 p-3">
                    <p className="text-xs font-medium text-gray-500 mb-1">{r.question_type}</p>
                    <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap mb-2 overflow-x-auto">
                      {typeof r.answer === 'string' ? r.answer : JSON.stringify(r.answer, null, 2)}
                    </pre>
                    <label className="text-xs text-gray-600 dark:text-gray-400 block">
                      Manual score (max {r.max_score ?? '—'})
                      <input
                        type="number"
                        min={0}
                        max={r.max_score ?? 100}
                        value={scores[item.sessionId]?.[r.question_id] ?? ''}
                        onChange={(e) =>
                          setScores((prev) => ({
                            ...prev,
                            [item.sessionId]: {
                              ...(prev[item.sessionId] ?? {}),
                              [r.question_id]: e.target.value,
                            },
                          }))
                        }
                        className="mt-1 w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
                      />
                    </label>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-4">No per-question responses stored; final score will use auto score.</p>
            )}

            <button
              type="button"
              disabled={submitting === item.sessionId}
              onClick={() => void handleGrade(item)}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting === item.sessionId ? 'Saving…' : 'Submit grades'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
