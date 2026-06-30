'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Award, ExternalLink, Loader2, CheckCircle, Clock } from 'lucide-react';
import { isAssessmentEmbedUrl } from '@/lib/assessment-url';
import { openExternalUrl } from '@/lib/open-external-url';

type LaunchResponse = {
  embedUrl?: string;
  takeUrl?: string;
  openInNewTab?: boolean;
  embedBlocked?: boolean;
  sheetFallback?: boolean;
  sessionId?: string;
  status?: string;
  alreadySubmitted?: boolean;
  title?: string;
  error?: string;
};

interface AssessmentStepEmbedProps {
  courseId: string;
  contentItemId: string;
  title: string;
  accessMode: 'lms_embed' | 'proctored_portal';
  onSubmitted?: () => void;
}

export function AssessmentStepEmbed({
  courseId,
  contentItemId,
  title,
  accessMode,
  onSubmitted,
}: AssessmentStepEmbedProps) {
  const [launch, setLaunch] = useState<LaunchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLaunch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/learning/courses/${courseId}/assessments/${contentItemId}/launch`,
        { method: 'POST', credentials: 'include' }
      );
      const data = (await res.json().catch(() => ({}))) as LaunchResponse;
      if (!res.ok) {
        setError(data.error ?? 'Failed to launch assessment');
        setLaunch(null);
        return;
      }
      setLaunch(data);
      if (data.alreadySubmitted || data.status === 'graded' || data.status === 'pending_manual_grade') {
        onSubmitted?.();
      }
    } catch {
      setError('Failed to launch assessment');
      setLaunch(null);
    } finally {
      setLoading(false);
    }
  }, [courseId, contentItemId, onSubmitted]);

  useEffect(() => {
    void fetchLaunch();
  }, [fetchLaunch]);

  useEffect(() => {
    const origin = process.env.NEXT_PUBLIC_ASSESSMENT_PRO_ORIGIN;
    if (!origin) return;
    function onMessage(event: MessageEvent) {
      if (event.origin !== origin) return;
      if (event.data?.type === 'assessment-pro:submitted') {
        void fetchLaunch();
        onSubmitted?.();
      }
    }
    window.addEventListener('message', onMessage as EventListener);
    return () => window.removeEventListener('message', onMessage as EventListener);
  }, [fetchLaunch, onSubmitted]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading assessment…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <p className="text-sm text-red-600 mb-3">{error}</p>
        <button
          type="button"
          onClick={() => void fetchLaunch()}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (launch?.alreadySubmitted || launch?.status === 'graded') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <CheckCircle className="w-10 h-10 text-emerald-500 mb-3" />
        <p className="font-medium text-gray-900 dark:text-white">{title}</p>
        <p className="text-sm text-gray-500 mt-2">Assessment submitted and graded.</p>
      </div>
    );
  }

  if (launch?.status === 'pending_manual_grade') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <Clock className="w-10 h-10 text-amber-500 mb-3" />
        <p className="font-medium text-gray-900 dark:text-white">{title}</p>
        <p className="text-sm text-gray-500 mt-2 max-w-md">
          Submitted — your instructor will review short answers before your final score is recorded.
        </p>
      </div>
    );
  }

  if (launch?.status === 'submitted' && accessMode === 'proctored_portal') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <Clock className="w-10 h-10 text-amber-500 mb-3" />
        <p className="font-medium text-gray-900 dark:text-white">{title}</p>
        <p className="text-sm text-gray-500 mt-2 max-w-md">Awaiting review in Assessment Pro.</p>
      </div>
    );
  }

  if ((accessMode === 'proctored_portal' || launch?.openInNewTab) && launch?.takeUrl) {
    const isSheetFallback = Boolean(launch.sheetFallback);
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <Award className="w-10 h-10 text-indigo-600 mb-3" />
        <p className="font-medium text-gray-900 dark:text-white mb-2">{launch.title ?? title}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-md">
          {isSheetFallback
            ? 'This module quiz includes Google Sheet questions. They open in a new tab so you can keep working in the lesson — no proctoring or exam setup.'
            : accessMode === 'proctored_portal'
              ? 'This exam opens in Assessment Pro in a new tab. You may need Google sign-in and proctoring setup.'
              : 'Open this assessment in Assessment Pro to continue.'}
        </p>
        <button
          type="button"
          onClick={() => { if (launch.takeUrl) openExternalUrl(launch.takeUrl); }}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
        >
          <ExternalLink className="w-4 h-4" />{' '}
          {isSheetFallback ? 'Open sheet question' : accessMode === 'proctored_portal' ? 'Start final exam' : 'Start assessment'}
        </button>
      </div>
    );
  }

  const takeInNewTab = Boolean(launch?.openInNewTab || launch?.embedBlocked);
  const newTabUrl = launch?.takeUrl ?? launch?.embedUrl;

  if (takeInNewTab && newTabUrl) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <Award className="w-10 h-10 text-indigo-600 mb-3" />
        <p className="font-medium text-gray-900 dark:text-white mb-2">{launch?.title ?? title}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-md">
          {launch?.embedBlocked
            ? 'This quiz cannot be embedded in the lesson yet (Assessment Pro iframe settings). Open it in a new tab to take the assessment.'
            : 'Open this assessment in Assessment Pro to continue.'}
        </p>
        <a
          href={newTabUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
        >
          <ExternalLink className="w-4 h-4" /> Start assessment
        </a>
      </div>
    );
  }

  if (launch?.embedUrl && isAssessmentEmbedUrl(launch.embedUrl)) {
    return (
      <iframe
        src={launch.embedUrl}
        title={launch.title ?? title}
        className="w-full flex-1 min-h-[60vh] border-0"
        allow="clipboard-read; clipboard-write"
      />
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center p-8 text-gray-500 text-sm">
      Assessment is not available.
    </div>
  );
}
