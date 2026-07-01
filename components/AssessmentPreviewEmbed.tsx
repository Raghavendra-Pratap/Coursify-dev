'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Award, ExternalLink, Loader2 } from 'lucide-react';
import { isAssessmentEmbedUrl } from '@/lib/assessment-url';

type PreviewResponse = {
  embedUrl?: string;
  takeUrl?: string;
  openInNewTab?: boolean;
  embedBlocked?: boolean;
  sheetFallback?: boolean;
  title?: string;
  error?: string;
};

interface AssessmentPreviewEmbedProps {
  assessmentProId: string;
  title: string;
  accessMode: 'lms_embed' | 'proctored_portal';
}

export function AssessmentPreviewEmbed({
  assessmentProId,
  title,
  accessMode,
}: AssessmentPreviewEmbedProps) {
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/instructor/assessments/preview-launch', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessmentProId,
          accessMode,
          title,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as PreviewResponse;
      if (!res.ok) {
        setError(data.error ?? 'Failed to load assessment preview');
        setPreview(null);
        return;
      }
      setPreview(data);
    } catch {
      setError('Failed to load assessment preview');
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, [assessmentProId, accessMode, title]);

  useEffect(() => {
    void fetchPreview();
  }, [fetchPreview]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-gray-500 dark:text-gray-400 min-h-[45vh]">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading assessment preview…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center min-h-[45vh]">
        <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>
        <button
          type="button"
          onClick={() => void fetchPreview()}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  const takeInNewTab = Boolean(
    preview?.openInNewTab || preview?.embedBlocked || accessMode === 'proctored_portal' ||
    (preview?.embedUrl && !isAssessmentEmbedUrl(preview.embedUrl))
  );
  const newTabUrl = preview?.takeUrl ?? preview?.embedUrl;

  if (takeInNewTab && newTabUrl) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center min-h-[45vh]">
        <Award className="w-10 h-10 text-indigo-600 mb-3" />
        <p className="font-medium text-gray-900 dark:text-white mb-2">{preview?.title ?? title}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 max-w-md">
          {preview?.sheetFallback
            ? 'This module quiz includes Google Sheet questions. They open in a new tab for preview — no proctoring.'
            : accessMode === 'proctored_portal'
              ? 'Final exams open in Assessment Pro. Preview how learners will start the exam.'
              : preview?.embedBlocked
                ? 'This quiz cannot be embedded here yet. Open it in a new tab to preview.'
                : 'Open this assessment in Assessment Pro to preview it.'}
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400 mb-6">Instructor preview — submissions are not recorded on course progress.</p>
        <a
          href={newTabUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
        >
          <ExternalLink className="w-4 h-4" /> Preview assessment
        </a>
      </div>
    );
  }

  if (preview?.embedUrl && isAssessmentEmbedUrl(preview.embedUrl)) {
    return (
      <div className="flex flex-col flex-1 min-h-[45vh]">
        <div className="flex-shrink-0 px-4 py-1.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-200 text-center">
          Instructor preview — learner view
        </div>
        <iframe
          src={preview.embedUrl}
          title={preview.title ?? title}
          className="w-full flex-1 min-h-[45vh] border-0 bg-white"
          allow="clipboard-read; clipboard-write"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center p-8 text-gray-500 dark:text-gray-400 text-sm min-h-[45vh]">
      Assessment preview is not available.
    </div>
  );
}
