'use client';

import { useEffect, useState } from 'react';
import { fetchJsonCached, readClientCache } from './client-fetch-cache';

type UseCachedFetchOptions = {
  enabled?: boolean;
  maxAgeMs?: number;
};

/** Stale-while-revalidate JSON fetch shared across shell pages. */
export function useCachedFetch<T>(
  cacheKey: string,
  url: string | null,
  deps: unknown[] = [],
  options: UseCachedFetchOptions = {}
) {
  const enabled = options.enabled !== false && Boolean(url);
  const maxAgeMs = options.maxAgeMs ?? 60_000;

  const [data, setData] = useState<T | null>(() =>
    enabled && url ? readClientCache<T>(cacheKey, maxAgeMs) : null
  );
  const [loading, setLoading] = useState(() =>
    enabled && url ? !readClientCache<T>(cacheKey, maxAgeMs) : false
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !url) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const cached = readClientCache<T>(cacheKey, maxAgeMs);
    if (cached) {
      setData(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    fetchJsonCached<T>(cacheKey, url, { maxAgeMs })
      .then(({ data: fresh }) => {
        if (cancelled) return;
        setData(fresh);
        setError(null);
      })
      .catch(() => {
        if (!cancelled && !cached) setError('Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, url, enabled, maxAgeMs, ...deps]);

  return { data, setData, loading, error, setError };
}
