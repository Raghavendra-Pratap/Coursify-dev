/** In-memory stale-while-revalidate cache for client page data (per tab session). */

type Entry<T> = { data: T; fetchedAt: number };

const store = new Map<string, Entry<unknown>>();

export function readClientCache<T>(key: string, maxAgeMs: number): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() - hit.fetchedAt > maxAgeMs) return null;
  return hit.data as T;
}

export function writeClientCache<T>(key: string, data: T): void {
  store.set(key, { data, fetchedAt: Date.now() });
}

export function invalidateClientCache(prefix: string): void {
  Array.from(store.keys()).forEach((key) => {
    if (key.startsWith(prefix)) store.delete(key);
  });
}

const DEFAULT_MAX_AGE_MS = 60_000;

/** Fetch JSON with stale-while-revalidate: show cached data instantly, refresh in background. */
export async function fetchJsonCached<T>(
  key: string,
  url: string,
  options?: { maxAgeMs?: number; credentials?: RequestCredentials }
): Promise<{ data: T; fromCache: boolean }> {
  const maxAge = options?.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const cached = readClientCache<T>(key, maxAge);

  const doFetch = async (): Promise<T> => {
    const res = await fetch(url, {
      credentials: options?.credentials ?? 'include',
      cache: 'default',
    });
    const data = (await res.json().catch(() => ({}))) as T;
    if (!res.ok) throw new Error('fetch failed');
    writeClientCache(key, data);
    return data;
  };

  if (cached != null) {
    void doFetch().catch(() => {});
    return { data: cached, fromCache: true };
  }

  const data = await doFetch();
  return { data, fromCache: false };
}
