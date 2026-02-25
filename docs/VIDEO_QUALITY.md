# Video quality control for varying learner connection speeds

Learners have different internet speeds. This doc explains what we support today and how to add **quality control** (adaptive or manual) so slower connections get watchable playback.

---

## What we have today

- **Single URL per video** (Google Drive preview, YouTube, or direct MP4 link).
- **Native `<video>`** in `MicroVideoPlayer`: one stream, no bitrate switching.
- **Buffering UX**: when the browser is waiting for data (`waiting` / `stalled`), we show a “Buffering…” overlay so learners know playback will resume. That doesn’t change quality; it only improves feedback on slow connections.

With a **single source URL**, we **cannot** change quality in code—the file is one bitrate. Quality control needs either multiple versions of the same video or a streaming format that supports multiple qualities (e.g. HLS).

---

## How to achieve real quality control

Two main approaches:

### 1. Adaptive bitrate (recommended for many learners)

**Idea:** Encode each video in several resolutions (e.g. 360p, 480p, 720p) and serve them as **HLS** (`.m3u8` + segments) or **DASH**. A player (e.g. Video.js + hls.js) measures bandwidth and **automatically** switches quality.

**You need:**

1. **Transcoding** from your source (e.g. MP4) to multi-bitrate HLS:
   - **FFmpeg** (self-hosted): produce HLS with multiple `-var_stream_map` renditions.
   - **Streaming service**: Mux, Cloudflare Stream, Bunny Stream, AWS MediaConvert, etc. You upload once; they output HLS/DASH and often provide a single embed URL that adapts.
2. **Hosting** for the HLS manifest and segments (CDN or same service).
3. **Player** that supports HLS:
   - **Video.js** + **hls.js**: use the HLS manifest URL as `src`; the player handles quality switching.
   - Replace or wrap the current `<video>` in `MicroVideoPlayer` with Video.js and point it at the HLS URL when the source is HLS.

**Result:** Learners on slow connections get lower resolution automatically; fast connections get higher resolution. No manual quality picker required (though many such players also expose one).

### 2. Manual quality (multiple renditions)

**Idea:** Encode and store two (or more) versions per video (e.g. “Low” 360p and “High” 720p). In the UI, let the learner choose “Low quality” or “High quality”; the player switches `src` to the corresponding URL.

**You need:**

- A pipeline (FFmpeg or a service) that produces at least two resolutions per video.
- Storing multiple URLs per segment (e.g. in DB: `video_url_low`, `video_url_high`, or a `qualities` JSON array).
- In `MicroVideoPlayer` (or `getVideoUrl`): accept a “prefer low quality” setting (e.g. from user preference or from a “Data saver” toggle) and return the low or high URL. Optional: show a quality dropdown when multiple URLs exist.

**Result:** Learners on slow connections can choose lower quality and get more stable playback; others can choose higher quality.

---

## Google Drive / YouTube

- **Google Drive preview** (iframe): we don’t control the player; Google may do some adaptation, but we can’t add our own quality logic. For **our** quality control, we need a direct or HLS URL we control (e.g. after transcoding Drive files or using another source).
- **YouTube**: YouTube’s embed already does adaptive bitrate. If the source is “YouTube”, no extra quality control is required on our side; we only need the embed URL.

---

## Summary

| Goal | Approach |
|------|----------|
| Better UX on slow connections **without** changing bitrate | ✅ Done: buffering overlay and “Quality / connection” tip in `MicroVideoPlayer`. |
| **Automatic** quality switching (adaptive) | Use HLS (or DASH) + transcoding (FFmpeg or streaming service) + Video.js/hls.js (or similar). |
| **Manual** quality (user picks Low/High) | Encode multiple resolutions; store multiple URLs; in the player or `getVideoUrl`, choose URL by user preference. |

So: **we can’t add quality control inside the current “single URL” method**; we **can** achieve it by introducing multi-bitrate sources (HLS or multiple URLs) and a player that uses them, as above.
