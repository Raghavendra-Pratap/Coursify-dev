'use client'

import { useRef, useEffect, useState } from 'react'
import { getVideoUrl } from '@/lib/video-utils'

interface MicroVideoPlayerProps {
  videoUrl: string
  startTime?: number | null
  endTime?: number | null
  storageType: 'google_drive' | 'supabase' | 'external_url'
  /** Called when segment reaches end (for playlist / seamless playback) */
  onEnded?: () => void
}

// Quality: single URL = no bitrate switch. Buffering UX helps slow connections.
// For adaptive quality see docs/VIDEO_QUALITY.md (HLS or streaming service).
export function MicroVideoPlayer({ videoUrl, startTime, endTime, storageType, onEnded }: MicroVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null)
  const [buffering, setBuffering] = useState(false)
  const [showLowQualityTip, setShowLowQualityTip] = useState(false)

  useEffect(() => {
    loadVideo()
  }, [videoUrl, storageType])

  const loadVideo = async () => {
    setLoading(true)
    setError(null)
    setBuffering(false)

    try {
      const url = await getVideoUrl(videoUrl, storageType)
      setResolvedUrl(url)

      if (videoRef.current) {
        videoRef.current.src = url
        if (startTime) {
          videoRef.current.currentTime = startTime
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load video')
    } finally {
      setLoading(false)
    }
  }

  // Enforce segment bounds: learner cannot play before start or after end
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const start = startTime != null ? startTime : 0
    const end = endTime != null ? endTime : undefined

    const clampToSegment = () => {
      if (video.currentTime < start) {
        video.currentTime = start
      }
      if (end != null && video.currentTime >= end) {
        video.currentTime = end
        video.pause()
        onEnded?.()
      }
    }

    const handleTimeUpdate = () => clampToSegment()
    const handleSeeked = () => clampToSegment()

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('seeked', handleSeeked)
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('seeked', handleSeeked)
    }
  }, [startTime, endTime, onEnded])

  // Quality / buffering UX: show overlay when waiting for data (slow connection)
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleWaiting = () => setBuffering(true)
    const handleCanPlay = () => setBuffering(false)
    const handlePlaying = () => setBuffering(false)
    const handleStalled = () => setBuffering(true)

    video.addEventListener('waiting', handleWaiting)
    video.addEventListener('canplay', handleCanPlay)
    video.addEventListener('playing', handlePlaying)
    video.addEventListener('stalled', handleStalled)
    return () => {
      video.removeEventListener('waiting', handleWaiting)
      video.removeEventListener('canplay', handleCanPlay)
      video.removeEventListener('playing', handlePlaying)
      video.removeEventListener('stalled', handleStalled)
    }
  }, [resolvedUrl])

  if (loading) {
    return (
      <div className="w-full aspect-video bg-gray-200 rounded flex items-center justify-center">
        <p className="text-gray-600">Loading video...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full aspect-video bg-gray-200 rounded flex items-center justify-center">
        <p className="text-red-600">Error: {error}</p>
      </div>
    )
  }

  return (
    <div className="w-full relative">
      <div className="relative">
        <video
          ref={videoRef}
          controls
          className="w-full rounded"
          onContextMenu={(e) => e.preventDefault()}
          onLoadedData={() => {
            if (videoRef.current && startTime) {
              videoRef.current.currentTime = startTime
            }
          }}
        >
          Your browser does not support the video tag.
        </video>
        {/* Buffering overlay for slow connections */}
        {buffering && (
          <div className="absolute inset-0 bg-black/50 rounded flex items-center justify-center">
            <div className="bg-gray-900/90 text-white px-4 py-2 rounded-lg text-sm font-medium">
              Buffering… Playback will resume when ready.
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between mt-1 gap-2">
        {(startTime !== null || endTime !== null) && (
          <p className="text-xs text-gray-500">
            {startTime != null && `Start: ${startTime}s`}
            {startTime != null && endTime != null && ' • '}
            {endTime != null && `End: ${endTime}s`}
          </p>
        )}
        <button
          type="button"
          className="text-xs text-gray-500 hover:text-gray-700 underline"
          onClick={() => setShowLowQualityTip(!showLowQualityTip)}
          title="Quality and data usage"
        >
          Quality / connection
        </button>
      </div>
      {showLowQualityTip && (
        <p className="text-xs text-gray-500 mt-1 bg-gray-100 rounded p-2">
          This video uses a single stream. If playback is slow, try pausing to let it buffer. Adaptive quality (auto-adjust for your connection) requires HLS or a streaming service—see docs for setup.
        </p>
      )}
    </div>
  )
}
