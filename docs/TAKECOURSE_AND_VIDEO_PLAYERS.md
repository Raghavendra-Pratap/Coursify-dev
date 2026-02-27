# TakeCourse Page & Video Players – Deep Dive

## Overview

The **TakeCourse** page is the learner view for a single course. It loads course structure and lesson content, shows one **step** at a time (video segment, reading, quiz, or form), and only allows marking the lesson complete after all required video segments are watched (fail-safe completion).

There are **two main player paths** in **LessonVideoPlayer**:

1. **YouTube** – IFrame API player with custom controls (no native YouTube UI).
2. **URL-based** – Split into:
   - **Direct video** (`.mp4`, `.webm`, etc.) – HTML5 `<video>` with custom controls and segment clamping.
   - **Iframe** (Google Drive, or other non-direct URLs) – Embedded iframe with a **timer-based** completion (we cannot read playback position cross-origin).

---

## Data Flow

### TakeCourse

- **APIs used:**
  - `GET /api/learning/courses/:courseId/content` – course title, modules, lessons, **completedLessonIds**.
  - `GET /api/learning/courses/:courseId/lessons/:lessonId` – lesson title/description, **contentItems** (each with `content_type`, and for video: **videoSegments** with `id`, `name`, `source`, `source_url`, `start_time_seconds`, `end_time_seconds`, `duration_seconds`).
- **State:**
  - `lessonContent` – current lesson + contentItems.
  - `completedSegments` – `Set<string>` of segment IDs the user has completed.
  - `currentStepIndex` – which step (video segment, reading, quiz, form) is shown.
- **Steps:** Content items are flattened into a **steps** array (each video segment = one step; each reading/quiz/form = one step). Only one step is rendered at a time; **Next** is disabled until the current video step is completed (or user clicks Continue for reading/quiz).

### Segment → Player

- TakeCourse builds a **segment** object per video step: `id`, `name`, `source`, `source_url`, `storage_path`, `start_time_seconds`, `end_time_seconds`, `duration_seconds`.
- This is passed to **LessonVideoPlayer** with `onSegmentComplete={() => { onSegmentComplete(step.segmentId); advance step } }`.
- Segment IDs are normalized to **string** so `completedSegments.has(id)` is reliable (API may return UUID string or legacy number).

---

## Player 1: YouTube

### How it works

- **Detection:** If `source_url` (or `sourceUrl` / `video_url`) looks like YouTube (`youtube.com/watch?v=`, `youtu.be/`), we treat as YouTube even if `source` is missing.
- **Load:** We inject the YouTube IFrame API script if needed, then create `new YT.Player(divId, { videoId, playerVars: { start, end, controls: 0, ... }, events: { onReady, onStateChange } })`.
- **Custom UI:** The iframe has `controls: 0`. We overlay a full “mirror” div that captures clicks (play/pause on click) and a custom control bar: seek (segment range), time display, volume, fullscreen.
- **Completion:**
  - **Primary:** `onStateChange(ev)` – when `ev.data === 0` (YT.PlayerState.ENDED) we call `markComplete()`.
  - **Backup:** A `requestAnimationFrame` loop polls `getCurrentTime()`; when `t >= end - 0.3` we `pauseVideo()` and `markComplete()`. This covers segments that don’t fire ENDED (e.g. when `end` is set).
- **Seek:** We use `seekTo(seconds, true)`. A short “seek cooldown” avoids immediately re-marking complete when the user seeks back.

### Edge cases / bugs fixed

- **YT.PlayerState** – Use numeric `1` for PLAYING (and `0` for ENDED) in case `YT.PlayerState` isn’t defined when the callback runs.
- **Cleanup** – On effect cleanup we destroy the player and clear the ref. We do **not** call `setYtReady(false)` / `setReadyPlayer(null)` in cleanup to avoid “setState on unmounted component” warnings when switching segments or unmounting.

---

## Player 2: URL-based (direct video)

### How it works

- **Detection:** `source` is not `youtube` and URL is a **direct video** file: `/\.(mp4|webm|ogg|mov)(\?|$)/i.test(url)`.
- **Rendering:** `<video src={url} preload="metadata" />` with custom overlay and control bar (play/pause, seek, volume, fullscreen). Native controls are not used; we use `controlsList="nodownload nofullscreen noplaybackrate"` and prevent context menu.
- **Segment clamping:** On `timeupdate` (and a small interval when playing) we clamp `currentTime` to `[start, effectiveEnd]` (effectiveEnd = min(end, video.duration)). So the learner cannot seek past the segment end.
- **Completion:** When `currentTime >= (effectiveEnd - effectiveStart) * completionThreshold + effectiveStart` (default 0.95) we call `markComplete()`. Also on `ended` we mark complete.
- **Start time:** In `onLoadedMetadata` we set `currentTime = start` if start > 0.

### Edge cases

- If `duration` is unknown (e.g. streaming), we use `end ?? start + segmentDuration` for the progress bar.
- **CORS:** Direct video URLs must allow the app origin; otherwise the video may not load (browser will show error and we show “Video could not be loaded”).

---

## Player 3: Iframe (Drive / other embeds)

### How it works

- **When used:** URL is not YouTube and not a direct video file (e.g. Google Drive share link, or other embeddable page).
- **Rendering:** `<iframe src={embedUrl} />`. For Drive we build a preview URL; for others we use the raw URL.
- **Completion:** We **cannot** read playback position cross-origin. So we use a **timer**: user clicks “Click to start segment”; we start a timer for `segmentDuration` seconds (or 60 if duration is 0). When the timer reaches the duration we mark the segment complete. A “Pause” button pauses the timer. So completion is honor-system + timer.

### Limitations

- User could start the timer and not watch; we don’t have a way to verify.
- If the instructor didn’t set segment duration, we assume 60s.

---

## TakeCourse completion logic

- **Required segments:** All segment IDs from all video content items in the lesson.
- **allSegmentsWatched:** `requiredSegmentIds.every(id => completedSegments.has(id))`.
- **canCompleteLesson:** If the lesson has video segments, we require `allSegmentsWatched`; otherwise (reading-only lesson) we allow complete immediately.
- **Auto-save:** When `allSegmentsWatched` becomes true we POST to `/api/learning/courses/:courseId/progress` with `{ lessonId }` and add the lesson to `completedLessonIds` so the UI updates and “Complete lesson” is no longer needed (button is disabled).
- **Manual “Complete lesson”:** Same POST; used when there are no video segments or if auto-save didn’t run.

---

## Bug fixes applied

1. **Segment IDs as strings** – `allVideoSegmentIds` and `step.segmentId` use `String(seg.id)` so Set lookups and step keys are consistent even if the API returns a number.
2. **YouTube cleanup** – Removed `setYtReady(false)` and `setReadyPlayer(null)` from the effect cleanup to avoid setState-after-unmount warnings.
3. **YouTube PLAYING state** – Use `ev.data === 1` instead of `ev.data === YT.PlayerState.PLAYING` so we don’t depend on `YT.PlayerState` being defined at callback time.

---

## Files

- **TakeCourse:** `components/pages/TakeCourse.tsx` – course/lesson loading, steps, completion, sidebar.
- **LessonVideoPlayer:** `components/LessonVideoPlayer.tsx` – YouTube, direct video, and iframe branches; custom controls; completion callbacks.
- **APIs:** `app/api/learning/courses/[courseId]/content/route.ts`, `app/api/learning/courses/[courseId]/lessons/[lessonId]/route.ts`, `app/api/learning/courses/[courseId]/progress/route.ts`.
