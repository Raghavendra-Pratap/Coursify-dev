# Add New Content Modal — Content Preview & Players

This doc describes how **content preview** works in the **Add New Content** modal (the one opened when you click "Add Video" on Create Course) and lists **all players** used there.

---

## 1. When does the preview show?

The preview block is rendered only when:

- The modal is open (`showUploadModal`).
- The user has entered a non‑empty URL in **Paste video link**.
- The URL is **recognized** as a supported type by `detectVideoLinkType(unifiedVideoUrl)`.

So: paste a valid YouTube, Google Drive, or other public streaming URL → the "Preview — play the video and set start/end from current position" section appears, and **one** of the players below is used based on the detected type.

---

## 2. How the source type is chosen

`detectVideoLinkType(url)` (in `CreateCourse.tsx`) returns:

| Detected type     | Condition |
|-------------------|-----------|
| `'youtube'`      | URL matches YouTube (e.g. `youtube.com/watch?v=...` or `youtu.be/...`); `getYouTubeVideoId(url)` is non‑null. |
| `'google_drive'`  | URL matches Google Drive file links; `getGoogleDriveFileId(url)` is non‑null. |
| `'external_url'`  | URL is `http://` or `https://` but not YouTube or Drive. |
| `null`            | Not a supported link → no preview. |

The UI shows **"Detected: YouTube"** / **"Detected: Google Drive"** / **"Video link (public streaming)"** from this same logic.

---

## 3. Players in the Add New Content modal

There are **three** players, one per source type. Only one is visible at a time, depending on the pasted URL.

### Player 1 — YouTube

- **When:** `detectVideoLinkType(unifiedVideoUrl) === 'youtube'` and `getYouTubeVideoId(unifiedVideoUrl)` is truthy.
- **What:** A **YouTube IFrame API** player.
  - A **placeholder div** is rendered: `<div id="create-course-yt-preview" className="w-full h-full" />`.
  - A **useEffect** (when modal is open, `uploadType === 'link'`, and URL is YouTube) loads the YouTube IFrame API if needed, then creates `new YT.Player('create-course-yt-preview', { videoId, ... })`, which **replaces** that div with the YouTube iframe.
- **Why this player:** Gives real playback and **readable current time** via `ytPreviewPlayerRef.current.getCurrentTime()` / `getDuration()`, so **Set start from current position** and **Set end from current position** work from the actual playback position.
- **State:** `ytPreviewReady` is set in the player’s `onReady`; the two buttons are enabled only when `ytPreviewReady` is true.

### Player 2 — Google Drive

- **When:** `detectVideoLinkType(unifiedVideoUrl) === 'google_drive'` and `getGoogleDriveFileId(unifiedVideoUrl)` is truthy.
- **What:** We try a **proxy `<video>`** first (same as Take Course): `getDriveProxyVideoUrl(fileId)` points to `/api/proxy-video?url=...`. If it loads (`onCanPlay`), we use it and show **Current position:** synced from the video’s `currentTime` (timeupdate + 200ms poll). If it fails (`onError`), we fall back to an **iframe** with `getGoogleDriveEmbedUrl(fileId, startSeconds)` so preview still works.
- **Why:** The proxy lets us read `currentTime` and `duration`, so **Set start from current position** and **Set end from current position** work when the proxy is ready. When the proxy fails (e.g. Drive sharing or CORS), the iframe fallback ensures the user can still preview and set start/end manually.
- **Set start/Set end:** When **proxy is ready** (`drivePreviewReady`), the two buttons are **enabled** and use `drivePreviewCurrentTime`. When we’re on **iframe fallback** (`drivePreviewError`), the buttons are disabled and the UI shows: **"Set start/end manually below for Google Drive (preview fallback)."** **Full video** uses the proxy’s `duration` when available, otherwise 23:59:59.

### Player 3 — External / public streaming URL

- **When:** `detectVideoLinkType(unifiedVideoUrl) === 'external_url'` (any other `http(s)` link that isn’t YouTube or Drive).
- **What:** A native **HTML5 `<video>`** element with `src={unifiedVideoUrl}`, `controls`, and `crossOrigin="anonymous"`. Ref: `linkPreviewVideoRef`.
- **Why this player:** Direct streaming URLs (e.g. some .mp4 links) can be played by the browser; we can read `currentTime` and `duration` from the element.
- **State:** `externalPreviewReady` is set in `onCanPlay`. **Set start** and **Set end** use `linkPreviewVideoRef.current.currentTime` and are enabled when `externalPreviewReady` is true.

---

## 4. Summary table

| Source type     | Player used in modal      | Set start/end from current position | Full video button |
|-----------------|---------------------------|-------------------------------------|--------------------|
| **YouTube**     | YouTube IFrame API (div → iframe) | Yes (when `ytPreviewReady`)         | Yes (from `getDuration()`) |
| **Google Drive**| Proxy `<video>` (fallback: iframe) | Yes when proxy ready; manual when fallback | Yes (proxy duration or 23:59:59) |
| **External URL**| `<video>` (same page)     | Yes (when `externalPreviewReady`)   | Yes (from `duration`)     |

---

## 5. Where it lives in code

- **Modal visibility:** `showUploadModal` (e.g. set when clicking “Add Video”).
- **URL input:** `unifiedVideoUrl`; detection via `detectVideoLinkType` / `getYouTubeVideoId` / `getGoogleDriveFileId`.
- **Preview block:** Only if `unifiedVideoUrl.trim() && detectVideoLinkType(unifiedVideoUrl)`.
- **Which player:** Three conditional blocks in the same preview area (YouTube div, Drive proxy `<video>` or iframe fallback, external `<video>`). A **key** on the preview container (link type + video id) forces a fresh mount when the pasted URL type or id changes.
- **YouTube init:** `useEffect` depending on `[showUploadModal, uploadType, unifiedVideoUrl]`; container id `create-course-yt-preview`.
- **Buttons:** “Set start from current position” and “Set end from current position” read time from the active player (YT ref, Drive `drivePreviewCurrentTime` when proxy ready, or `linkPreviewVideoRef`) and enable/disable based on the corresponding ready state; for Drive fallback, manual Start/End below.

---

## 6. Note on Drive proxy vs iframe

- **YouTube** and **external** use players we control (YT API and `<video>`), so we can read current time and drive **Set start/Set end from current position**.
- **Drive** first tries the **proxy `<video>`** to show **Current position** and enable Set start/Set end from playback; if the proxy fails we show the **iframe** and "Set start/end manually below for Google Drive (preview fallback)."
