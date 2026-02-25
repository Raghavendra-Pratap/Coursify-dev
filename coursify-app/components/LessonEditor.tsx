'use client'

import { useState, useEffect } from 'react'
import type { Lesson, VideoSegment } from '@/lib/types'
import { VideoSegmentEditor } from './VideoSegmentEditor'
import { GoogleDrivePicker } from './GoogleDrivePicker'
import { createClient } from '@/lib/supabase-client'

interface LessonEditorProps {
  lesson: Lesson
  moduleId: string
}

export function LessonEditor({ lesson, moduleId }: LessonEditorProps) {
  const [segments, setSegments] = useState<VideoSegment[]>([])
  const [loading, setLoading] = useState(true)
  const [showDrivePicker, setShowDrivePicker] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadSegments()
  }, [lesson.id])

  const loadSegments = async () => {
    try {
      const { data, error } = await supabase
        .from('video_segments')
        .select('*')
        .eq('lesson_id', lesson.id)
        .order('segment_index')

      if (error) throw error
      if (data) {
        setSegments(data)
      }
    } catch (err) {
      console.error('Error loading segments:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddSegment = async (videoUrl: string, storageType: 'google_drive' | 'supabase' | 'external_url', storagePath?: string) => {
    try {
      const maxIndex = segments.length > 0
        ? Math.max(...segments.map(s => s.segment_index))
        : -1

      const { data, error } = await supabase
        .from('video_segments')
        .insert({
          lesson_id: lesson.id,
          segment_index: maxIndex + 1,
          video_url: videoUrl,
          storage_type: storageType,
          storage_path: storagePath || null,
        })
        .select()
        .single()

      if (error) throw error
      if (data) {
        setSegments([...segments, data])
        setShowDrivePicker(false)
      }
    } catch (err) {
      console.error('Error adding segment:', err)
      alert('Failed to add video segment')
    }
  }

  const handleDeleteSegment = async (segmentId: string) => {
    if (!confirm('Are you sure you want to delete this segment?')) return

    try {
      const { error } = await supabase
        .from('video_segments')
        .delete()
        .eq('id', segmentId)

      if (error) throw error
      setSegments(segments.filter(s => s.id !== segmentId))
    } catch (err) {
      console.error('Error deleting segment:', err)
      alert('Failed to delete segment')
    }
  }

  if (loading) {
    return <div>Loading lesson...</div>
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{lesson.title}</h3>
        <p className="text-sm text-gray-600 mt-1">
          Content Type: {lesson.content_type}
        </p>
      </div>

      {lesson.content_type === 'video' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-medium">Video Segments</h4>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDrivePicker(true)}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
              >
                Add from Google Drive
              </button>
              <button
                onClick={() => {
                  // TODO: Implement file upload
                  alert('File upload coming soon')
                }}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Upload Video
              </button>
            </div>
          </div>

          {showDrivePicker && (
            <GoogleDrivePicker
              onSelect={(url, path) => handleAddSegment(url, 'google_drive', path)}
              onCancel={() => setShowDrivePicker(false)}
            />
          )}

          <div className="space-y-2">
            {segments.map((segment, index) => (
              <VideoSegmentEditor
                key={segment.id}
                segment={segment}
                index={index}
                onDelete={() => handleDeleteSegment(segment.id)}
              />
            ))}
          </div>

          {segments.length === 0 && (
            <div className="text-center py-8 border-2 border-dashed rounded text-gray-500">
              No video segments yet. Add your first segment to get started.
            </div>
          )}
        </div>
      )}

      {lesson.content_type !== 'video' && (
        <div className="text-center py-8 text-gray-500">
          Content editor for {lesson.content_type} coming soon
        </div>
      )}
    </div>
  )
}
