'use client'

import { useState } from 'react'
import type { VideoSegment } from '@/lib/types'
import { MicroVideoPlayer } from './MicroVideoPlayer'
import { createClient } from '@/lib/supabase-client'

interface VideoSegmentEditorProps {
  segment: VideoSegment
  index: number
  onDelete: () => void
}

export function VideoSegmentEditor({ segment, index, onDelete }: VideoSegmentEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [startTime, setStartTime] = useState(segment.start_time?.toString() || '')
  const [endTime, setEndTime] = useState(segment.end_time?.toString() || '')
  const supabase = createClient()

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from('video_segments')
        .update({
          start_time: startTime ? parseFloat(startTime) : null,
          end_time: endTime ? parseFloat(endTime) : null,
        })
        .eq('id', segment.id)

      if (error) throw error
      setIsEditing(false)
    } catch (err) {
      console.error('Error updating segment:', err)
      alert('Failed to update segment')
    }
  }

  return (
    <div className="border rounded-lg p-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h5 className="font-medium">Segment {index + 1}</h5>
          <p className="text-sm text-gray-600">
            {segment.storage_type === 'google_drive' ? '📁 Google Drive' : '📤 Uploaded'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
          >
            {isEditing ? 'Cancel' : 'Edit'}
          </button>
          <button
            onClick={onDelete}
            className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Start Time (seconds)</label>
              <input
                type="number"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-2 py-1 text-sm border rounded"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">End Time (seconds)</label>
              <input
                type="number"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-2 py-1 text-sm border rounded"
                placeholder="Auto"
              />
            </div>
          </div>
          <button
            onClick={handleSave}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      ) : (
        <div>
          <MicroVideoPlayer
            videoUrl={segment.video_url}
            startTime={segment.start_time}
            endTime={segment.end_time}
            storageType={segment.storage_type}
          />
        </div>
      )}
    </div>
  )
}
