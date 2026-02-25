'use client';

import React, { useState, useEffect } from 'react';
import { BookOpen, Video, HelpCircle, RefreshCw, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { usePreferenceLoop } from '@/lib/use-preference-loop';
import type { ContentType } from '@/lib/preference-loop';

export function LearningPreferences() {
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const { preferences, loading, recordActivity, refresh } = usePreferenceLoop(userId);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted && session?.user?.id) setUserId(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (mounted) setUserId(session?.user?.id ?? undefined);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleRecordSample = async (contentType: ContentType) => {
    if (!userId) return;
    await recordActivity({
      user_id: userId,
      content_type: contentType,
      entity_type: 'lesson',
      entity_id: '00000000-0000-0000-0000-000000000000',
      action: 'completed',
      time_spent_seconds: 120,
    });
  };

  if (!userId) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-bold mb-2 flex items-center">
          <Zap className="w-5 h-5 mr-2 text-amber-500" />
          Learning preferences
        </h3>
        <p className="text-gray-600 text-sm">Sign in to see preferences learned from your activity.</p>
      </div>
    );
  }

  if (loading && !preferences) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-bold mb-2 flex items-center">
          <Zap className="w-5 h-5 mr-2 text-amber-500" />
          Learning preferences
        </h3>
        <p className="text-gray-600 text-sm">Preferences will appear here once you complete some content or use the buttons below.</p>
        <button type="button" onClick={() => refresh()} className="mt-3 text-sm text-blue-600 hover:underline">Refresh</button>
      </div>
    );
  }

  const p = preferences;
  const videoPct = Math.round(p.content_video_weight * 100);
  const readingPct = Math.round(p.content_reading_weight * 100);
  const quizPct = Math.round(p.content_quiz_weight * 100);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold flex items-center">
          <Zap className="w-5 h-5 mr-2 text-amber-500" />
          Learning preferences
        </h3>
        <button
          type="button"
          onClick={() => refresh()}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Inferred from your activity (completions, skips, time spent). Used to order and recommend content.
      </p>
      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-3">
          <Video className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span>Video</span>
              <span>{videoPct}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${videoPct}%` }} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <BookOpen className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span>Reading</span>
              <span>{readingPct}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full" style={{ width: `${readingPct}%` }} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <HelpCircle className="w-4 h-4 text-purple-600 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span>Quiz / Form</span>
              <span>{quizPct}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 rounded-full" style={{ width: `${quizPct}%` }} />
            </div>
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Pace: {p.pace_score < 0.4 ? 'Faster' : p.pace_score > 0.6 ? 'Slower' : 'Medium'}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => handleRecordSample('video')}
          className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
        >
          + Video
        </button>
        <button
          type="button"
          onClick={() => handleRecordSample('reading')}
          className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200"
        >
          + Reading
        </button>
        <button
          type="button"
          onClick={() => handleRecordSample('quiz')}
          className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
        >
          + Quiz
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-2">Simulate activity to see weights update (self-learning loop).</p>
    </div>
  );
}
