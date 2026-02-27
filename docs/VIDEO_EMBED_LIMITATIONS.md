# Video embed (YouTube) – mirror overlay approach

## How it works

For **YouTube** segments in the learner view we use **`controls=0`** so the native YouTube UI (Share, title bar, “Watch on YouTube”, right-click menu) is hidden. Learners **cannot** click or right-click the video itself.

We then add a **full overlay** (a “mirror”) on top of the player that:

- Captures all pointer events, so the learner watches the video but **cannot touch the iframe**.
- Shows **our own controls** driven by the YouTube IFrame API: Play/Pause, seek bar (within segment), time display, volume/mute, fullscreen.

So the learner gets the controls they need (play, pause, seek, volume, fullscreen) without ever interacting with YouTube’s UI or getting links to the source.

## What we control

- **Play / Pause** – Via `playVideo()` / `pauseVideo()`.
- **Seek** – Via `seekTo(seconds)`; clamped to segment start/end.
- **Time display** – From `getCurrentTime()`; we show segment-relative time.
- **Volume / Mute** – Via `setVolume()`, `mute()`, `unMute()`.
- **Fullscreen** – We fullscreen our container (the overlay + video), not the iframe.
- **Segment end** – We poll `getCurrentTime()` and pause + mark complete when the segment end is reached.
- **Right-click** – Disabled on the overlay; the iframe never receives clicks.

## What we don’t control

- **Quality / resolution** – YouTube doesn’t expose a “set quality” in the embed API in a way we can drive from our UI. Learners cannot choose quality from our bar; the default quality is used.
- **Captions** – Could be added later via the API if needed.

## Direct video (.mp4, .webm, etc.)

For **direct video URLs** we use a **custom control bar** (no native browser controls). This allows us to:

- **Disable** pop-out, picture-in-picture, and CC (they are not shown).
- **Segment-only timeline** – the seek bar and time display are scoped to the segment; playback is clamped so the user cannot seek beyond the segment end.

Learners get play/pause, segment seek, volume, and fullscreen only.

## Embedded iframes (Google Drive, external URLs)

For **Google Drive** or other **embedded URLs** we load the host’s player in an iframe. We **cannot** hide or disable the host’s buttons (pop-out, PiP, CC, full timeline) because the iframe is cross-origin. Segment completion is timer-based.

## App-wide

- **DisableContextMenu** in the root layout still disables right-click on the rest of the app (sidebar, text, buttons).

Reference: [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference).
