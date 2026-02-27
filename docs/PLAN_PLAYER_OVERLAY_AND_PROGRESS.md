# Plan: Same controls (YouTube + Drive), overlay click = play/pause, fix progress bar

## Your suggestion: overlay click toggles play/pause

**Idea:** One overlay on the player. Click → play video and move slider/time. Click again → pause. Click again → play. So each click toggles play/pause.

**Feedback:**

- **Good fit:** Matches how many video UIs work (click to play/pause). Same behavior on YouTube, Drive, and direct video keeps the experience consistent.
- **Already there for YouTube and direct video:** Both already use a full overlay with `onClick={handlePlayPause}` so click = play or pause. So we only need to align **Drive/iframe** with this.
- **Drive/iframe limitation:** We cannot truly play/pause the video inside the iframe (cross-origin). So for Drive we interpret “play” as “start the segment timer (slider and time move)” and “pause” as “pause the timer”. The host video can still be playing; we only control our timer. So:
  - **Click 1:** Start timer → overlay fades so user sees the video; slider and time advance.
  - **Click 2:** Pause timer → overlay can show again (or stay transparent); slider and time stop.
  - **Click 3:** Resume timer; slider and time advance again.
- **Control bar:** Use the **same layout** for YouTube and Drive: progress slider, then row with [Play/Pause] [current / total] [mute] [volume] [fullscreen]. For Drive, volume stays “in video area” (we can’t control iframe volume), but the bar looks the same.

---

## Progress bar not working – causes and fixes

### 1. YouTube

- **Cause:** When the segment has **no end time**, we use `effectiveDuration = Math.max(0.001, (end ?? start) - start)` which is `0.001`. Then `progress = (ytCurrentTime - start) / 0.001` becomes huge and is clamped to 1, so the bar jumps to 100% and looks broken.
- **Fix:** In the `requestAnimationFrame` loop, when `end` is null, call `player.getDuration()`. Store that duration in state (e.g. `ytDuration`). Use it for `effectiveDuration` when `end` is null: `effectiveDuration = ytDuration > 0 ? ytDuration - start : segmentDuration || 0.001`, so the progress bar reflects real playback.

### 2. Direct video (.mp4, etc.)

- **Cause:** `effectiveEnd` and `effectiveDuration` are computed from `videoRef.current.duration` **at render time**. Refs don’t trigger re-renders, so when the video loads and `duration` becomes valid, the component doesn’t re-render and the progress denominator stays wrong (0 or NaN). So the bar can stay at 0 or jump to 100%.
- **Fix:** Store the video’s duration in **state** (e.g. `videoDuration`). Set it in `onLoadedMetadata` (e.g. `setVideoDuration(v.duration)`). Use `videoDuration` (and segment `start`/`end`) to compute `effectiveDuration` for the progress bar so the bar updates correctly after load.

### 3. Drive/iframe

- Progress is **timer-based** (we can’t read iframe position). The slider and time already move with the timer when it’s running. Making “overlay click = toggle timer” will keep that behavior and match the “click to play/pause” idea.

---

## Implementation checklist

1. **YouTube**
   - Add state `ytDuration` (number).
   - In the rAF loop, when `end == null` and we have the player, call `getDuration()` and set `ytDuration` once.
   - Compute `effectiveDuration` using `ytDuration` when `end` is null so the progress bar is correct.

2. **Direct video**
   - Add state `videoDuration` (number, 0 or NaN = unknown).
   - In `onLoadedMetadata`, set `videoDuration(el.duration)`.
   - Compute `effectiveEnd` / `effectiveDuration` from `videoDuration` and segment start/end so the progress bar and seek use the right range.

3. **Drive/iframe**
   - **Overlay:** One overlay that’s always present (so clicks don’t hit the iframe). Click = toggle: if timer not running → start timer; if running → pause timer. When running, overlay can be transparent (or minimal) so the user sees the video; when paused, show a clear “Play” affordance.
   - **Control bar:** Same structure as YouTube: slider (read-only, driven by timer), then [Play/Pause] [elapsed / total] [volume icon] [fullscreen]. Play/Pause toggles the timer. Remove the separate “Pause” button and “Click to start segment” copy; rely on “Click to play / click again to pause” and the bar’s Play/Pause button.

4. **Shared**
   - Ensure overlay is a single layer: click anywhere on the video (except the control bar, which uses `stopPropagation`) toggles play/pause (or timer for iframe). No extra “start” step for iframe—first click = play (start timer), second = pause, etc.

---

## Summary

| Player   | Overlay click      | Progress bar fix                                      |
|----------|--------------------|--------------------------------------------------------|
| YouTube  | Already toggles play/pause | Use getDuration() when end is null; store in state   |
| Direct   | Already toggles play/pause | Store duration in state from onLoadedMetadata        |
| Drive    | Toggle timer (play/pause)  | Already timer-based; unify control bar layout        |

This gives the same controls and overlay behavior everywhere, and fixes the progress bar for YouTube and direct video.
