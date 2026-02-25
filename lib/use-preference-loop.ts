'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getPreferences,
  recordActivity as recordActivityApi,
  type LearnerPreferences,
  type LearnerActivityRow,
} from '@/lib/preference-loop';

/**
 * Hook for the self-learning preference loop.
 * - preferences: current inferred preferences (or null if not loaded / no user).
 * - recordActivity: call when the learner completes/views/skips content.
 * - refresh: re-fetch preferences (e.g. after recording activity).
 */
export function usePreferenceLoop(userId: string | undefined) {
  const [preferences, setPreferences] = useState<LearnerPreferences | null>(null);
  const [loading, setLoading] = useState(!!userId);

  const refresh = useCallback(async () => {
    if (!userId) {
      setPreferences(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const p = await getPreferences(userId);
      setPreferences(p);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const recordActivity = useCallback(
    async (row: LearnerActivityRow) => {
      if (!userId) return;
      await recordActivityApi(userId, row);
      await refresh();
    },
    [userId, refresh]
  );

  return { preferences, loading, recordActivity, refresh };
}
