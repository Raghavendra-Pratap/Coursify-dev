# Navigation and loading performance

This document describes how Coursify keeps shell navigation fast (Dashboard, My Courses, Learners, Analytics, Q&A, Notes, Profile, Settings) for **both instructor and learner** modes, without changing product behavior.

**Last updated:** 2025-06 (develop: `f15a55ad` and earlier perf commits)

---

## Goals

- Tab switches should feel **instant** — no blank pages, no “Loading…” flash when cached data exists.
- Network refreshes happen **in the background** (stale-while-revalidate).
- **First login** prefetches all shell endpoints in parallel so the first click is already warm.
- **Hard refresh** can still feel fast via **localStorage** persistence (5-minute TTL).

Take Course and Create Course are intentionally heavier (video player, full course tree) and are not part of this instant shell.

---

## Architecture overview

```
Login / session mode set
        │
        ▼
prefetchShellData(mode, userId)     ──► parallel fetch all shell APIs
        │
        ▼
KeepAliveView (CoursifyLMS)         ──► pages stay mounted; switch = CSS hidden toggle
        │
        ▼
readClientCache (sync, µs)          ──► memory Map, then localStorage
        │
        ▼
useState initializer / useCachedFetch ──► first paint uses cache (no flash)
        │
        ▼
fetchJsonCached (background)        ──► refresh quietly; update cache
```

---

## Key files

| File | Role |
|------|------|
| `lib/client-fetch-cache.ts` | In-memory + localStorage cache; `fetchJsonCached`, `SHELL_CACHE_MS` (5 min) |
| `lib/use-cached-fetch.ts` | React hook: sync hydrate from cache, background revalidate |
| `lib/prefetch-shell-data.ts` | Login prefetch + per-nav hover prefetch |
| `components/CoursifyLMS.tsx` | `KeepAliveView`, prefetch on auth, nav hover warmup |
| `app/api/instructor/my-courses/route.ts` | Unified instructor course list (replaces client waterfall) |
| `app/api/instructor/dashboard/route.ts` | Dashboard stats; scoped progress queries + cache headers |

---

## Shell keep-alive

In `components/CoursifyLMS.tsx`, these views use `KeepAliveView` (mounted once, toggled with `hidden`):

- **Instructor:** dashboard, courses, learners, analytics, reports, qa, profile, settings
- **Learner:** courses (My learning), notes, qa, profile, settings

**Not keep-alive:** `create`, `take` — loaded via `next/dynamic` to limit bundle size and avoid keeping video state in memory when navigating away.

---

## Client cache

### Memory + localStorage

- Keys prefixed with `instructor:`, `learning:`, `notifications:`, or `notification-preferences` are persisted to `localStorage` under `coursify:cache:{key}`.
- Default TTL: **`SHELL_CACHE_MS` = 5 minutes** (`lib/client-fetch-cache.ts`).
- Notifications: **30 seconds** TTL.

### Stale-while-revalidate

`fetchJsonCached(key, url)`:

1. If cache hit → return immediately, fire background fetch.
2. If cache miss → await fetch, write cache, return.

Pages initialize `useState` from `readClientCache()` so the first render never shows a loading skeleton when data is already available.

---

## Prefetch

### On login (session mode known)

`prefetchShellData(mode, userId)` in `CoursifyLMS`:

**Instructor** — dashboard, my-courses, learners, analytics, questions, notification-preferences, notifications.

**Learner** — enrolled courses, my-questions, notes, notification-preferences, notifications.

### On nav hover / focus

`prefetchShellView(view, mode, userId)` warms the cache for the target page before click.

---

## Instructor vs learner coverage

| Page | Instructor | Learner |
|------|------------|---------|
| Dashboard | ✅ cache + prefetch | N/A (not in nav) |
| My Courses / My learning | ✅ unified API + cache | ✅ `learning:enrolled` + cache |
| Learners | ✅ cache + prefetch | N/A |
| Analytics | ✅ `useCachedFetch` | N/A |
| Q & A | ✅ `instructor:questions` | ✅ `learning:my-questions` |
| My Notes | N/A | ✅ `learning:notes:{userId}` |
| Profile / Settings | ✅ keep-alive; Settings cached | ✅ same |
| Notifications | ✅ 30s cache | ✅ same |
| Take Course | ⚠️ `cache: 'no-store'` (by design) | ⚠️ same |

### Known gaps (future work)

- **Profile** — keep-alive yes; no sync cache hydrate yet (Supabase on mount).
- **Instructor pages in learner mode** — keep-alive mounts instructor views in the background; they may prefetch instructor APIs even when the user is in learner mode (wasted bandwidth, not blocking UX).
- **Take Course** — course content/progress not cached; opening a course always hits the network.
- **Cache invalidation** — mutations (create course, invite learner) do not yet call `invalidateClientCache()`; data refreshes on TTL or background revalidate.

---

## API optimizations

### Unified instructor course list

`GET /api/instructor/my-courses` — single server round-trip for courses, module/lesson counts, learner stats, content mix. Replaces multiple client-side Supabase queries in `MyCourses.tsx`.

### Dashboard

`GET /api/instructor/dashboard?period=7days` — progress filtered by enrollment IDs (not full-table scan). Response includes `Cache-Control: private, max-age=15, stale-while-revalidate=60`.

### Read API cache headers

These GET routes send short private cache headers (browser + CDN hint):

- `instructor/dashboard`, `instructor/my-courses`, `instructor/learners`, `instructor/analytics`
- `instructor/questions`, `learning/enrolled`, `learning/my-questions`, `learning/notes`
- `notifications`, `notification-preferences`

---

## Earlier optimizations (still in place)

### Lazy-loading heavy pages

`CreateCourse` and `TakeCourse` use `next/dynamic` with `ssr: false` and a loading fallback. Other shell pages are **static imports** (keep-alive requires them mounted).

Previously, six pages were dynamic; that was reversed for shell pages to enable instant tab switching.

### TakeCourse

- `useMemo` for `requiredSegmentIds` and `totalLessons`
- Parallel fetch of content + progress APIs on course open (`Promise.all`)

---

## Verifying performance

1. Sign in (instructor or learner).
2. Wait ~2s for prefetch to complete.
3. Switch: Dashboard ↔ My Courses ↔ Learners ↔ Analytics (or learner: My learning ↔ Notes ↔ Q&A).
4. **Second visit to each tab** should be immediate (no skeleton).
5. Hard refresh — first paint should still show cached data if within 5 minutes.

---

## Related docs

- [CODEBASE_MAP.md](CODEBASE_MAP.md) — file locations
- [BRANCH_AND_DEPLOY.md](BRANCH_AND_DEPLOY.md) — `develop` → Vercel
- [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) — product overview
