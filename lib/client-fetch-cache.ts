/** In-memory + localStorage stale-while-revalidate cache for shell page data. */

type Entry<T> = { data: T; fetchedAt: number };

const store = new Map<string, Entry<unknown>>();

/** Shell nav data: show instantly, refresh quietly in background. */
export const SHELL_CACHE_MS = 5 * 60_000;

const PERSIST_PREFIXES = ['instructor:', 'learning:', 'notifications:', 'notification-preferences'];

function diskKey(key: string): string {
  return `coursify:cache:${key}`;
}

function readDiskEntry<T>(key: string): Entry<T> | null {
  if (typeof window === 'undefined') return null;
  if (!PERSIST_PREFIXES.some((p) => key.startsWith(p))) return null;
  try {
    const raw = localStorage.getItem(diskKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Entry<T>;
    if (!parsed || typeof parsed.fetchedAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeDiskEntry<T>(key: string, entry: Entry<T>): void {
  if (typeof window === 'undefined') return;
  if (!PERSIST_PREFIXES.some((p) => key.startsWith(p))) return;
  try {
    localStorage.setItem(diskKey(key), JSON.stringify(entry));
  } catch {
    // Quota exceeded — memory cache still works for this session.
  }
}

function removeDiskEntry(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(diskKey(key));
  } catch {
    // ignore
  }
}

export function readClientCache<T>(key: string, maxAgeMs: number): T | null {
  const hit = store.get(key);
  if (hit && Date.now() - hit.fetchedAt <= maxAgeMs) return hit.data as T;

  const disk = readDiskEntry<T>(key);
  if (disk && Date.now() - disk.fetchedAt <= maxAgeMs) {
    store.set(key, disk);
    return disk.data;
  }
  return null;
}

export function writeClientCache<T>(key: string, data: T): void {
  const entry: Entry<T> = { data, fetchedAt: Date.now() };
  store.set(key, entry);
  writeDiskEntry(key, entry);
}

export function invalidateClientCache(prefix: string): void {
  Array.from(store.keys()).forEach((key) => {
    if (key.startsWith(prefix)) store.delete(key);
  });
  if (typeof window === 'undefined') return;
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith('coursify:cache:') && k.slice('coursify:cache:'.length).startsWith(prefix)) {
        localStorage.removeItem(k);
      }
    }
  } catch {
    // ignore
  }
}

const DEFAULT_MAX_AGE_MS = SHELL_CACHE_MS;

/** Fetch JSON with stale-while-revalidate: show cached data instantly, refresh in background. */
export async function fetchJsonCached<T>(
  key: string,
  url: string,
  options?: { maxAgeMs?: number; credentials?: RequestCredentials; forceRefresh?: boolean }
): Promise<{ data: T; fromCache: boolean }> {
  const maxAge = options?.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  if (options?.forceRefresh) {
    invalidateClientCache(key);
  }
  const cached = options?.forceRefresh ? null : readClientCache<T>(key, maxAge);

  const doFetch = async (): Promise<T> => {
    const res = await fetch(url, {
      credentials: options?.credentials ?? 'include',
      cache: 'default',
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) {
      const msg = typeof data?.error === 'string' ? data.error : res.statusText || 'fetch failed';
      throw new Error(msg);
    }
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
