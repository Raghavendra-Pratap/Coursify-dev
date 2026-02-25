'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import type { Module, Lesson, VideoSegment } from '@/lib/types'
import { MicroVideoPlayer } from './MicroVideoPlayer'
import { recordActivity } from '@/lib/preference-loop'
import type { ContentType } from '@/lib/preference-loop'

interface LearnerViewProps {
  courseId: string
  userId: string
}

export function LearnerView({ courseId, userId }: LearnerViewProps) {
  const [modules, setModules] = useState<Module[]>([])
  const [lessonsByModuleId, setLessonsByModuleId] = useState<Record<string, Lesson[]>>({})
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null)
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [segments, setSegments] = useState<VideoSegment[]>([])
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadCourseContent()
  }, [courseId])

  useEffect(() => {
    if (selectedLesson) {
      loadLesson(selectedLesson)
    }
  }, [selectedLesson])

  const loadCourseContent = async () => {
    try {
      const { data, error } = await supabase
        .from('modules')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index')

      if (error) throw error
      if (data) {
        setModules(data)
        const moduleIds = (data ?? []).map((m: { id: string }) => m.id).filter(Boolean)
        if (moduleIds.length === 0) {
          setLessonsByModuleId({})
          setLoading(false)
          return
        }

        const { data: lessons, error: lessonsError } = await supabase
          .from('lessons')
          .select('*')
          .in('module_id', moduleIds)
          .order('order_index')

        if (lessonsError) throw lessonsError
        const byModule: Record<string, Lesson[]> = {}
        for (const id of moduleIds) byModule[id] = []
        for (const l of lessons ?? []) {
          if (l.module_id && byModule[l.module_id]) byModule[l.module_id].push(l)
        }
        setLessonsByModuleId(byModule)

        // Select first lesson of first module if none selected
        const firstModuleLessons = byModule[moduleIds[0]] ?? []
        if (firstModuleLessons.length > 0) {
          setSelectedLesson(firstModuleLessons[0].id)
        }
      }
    } catch (err) {
      console.error('Error loading course content:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadLesson = async (lessonId: string) => {
    try {
      const { data: lessonData, error: lessonError } = await supabase
        .from('lessons')
        .select('*')
        .eq('id', lessonId)
        .single()

      if (lessonError) throw lessonError
      if (lessonData) {
        setLesson(lessonData)
        setCurrentSegmentIndex(0)

        if (lessonData.content_type === 'video') {
          const { data: segmentsData, error: segmentsError } = await supabase
            .from('video_segments')
            .select('*')
            .eq('lesson_id', lessonId)
            .order('segment_index')

          if (segmentsError) throw segmentsError
          if (segmentsData) {
            setSegments(segmentsData)
          }
        } else {
          setSegments([])
        }
      }
    } catch (err) {
      console.error('Error loading lesson:', err)
    }
  }

  const handleLessonComplete = async () => {
    if (!lesson || !selectedLesson) return

    try {
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('course_id', courseId)
        .eq('user_id', userId)
        .single()

      if (enrollment) {
        const { error } = await supabase
          .from('progress')
          .upsert({
            enrollment_id: enrollment.id,
            lesson_id: selectedLesson,
            completed: true,
            completed_at: new Date().toISOString(),
          })

        if (error) throw error

        // Self-learning preference loop: record activity so preferences update
        const lessonType = (lesson as { content_type?: string }).content_type;
        const contentType: ContentType =
          lessonType === 'quiz'
            ? 'quiz'
            : lessonType === 'document' || lessonType === 'text'
              ? 'reading'
              : 'video'
        await recordActivity(userId, {
          user_id: userId,
          content_type: contentType,
          entity_type: 'lesson',
          entity_id: selectedLesson,
          action: 'completed',
          time_spent_seconds: 0,
        })
      }
    } catch (err) {
      console.error('Error marking lesson complete:', err)
    }
  }

  if (loading) {
    return <div>Loading course...</div>
  }

  return (
    <div className="grid grid-cols-4 gap-6">
      {/* Sidebar */}
      <div className="col-span-1 bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold mb-4">Course Content</h3>
        <div className="space-y-4">
          {modules.map((module) => {
            const lessons = lessonsByModuleId[module.id] ?? []
            return (
              <div key={module.id}>
                <h4 className="font-medium text-sm mb-2">{module.title}</h4>
                <ul className="text-xs text-gray-600 ml-2 space-y-1">
                  {lessons.map((l) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedLesson(l.id)}
                        className={`text-left w-full px-2 py-1 rounded truncate block hover:bg-gray-100 ${
                          selectedLesson === l.id ? 'bg-blue-50 text-blue-700 font-medium' : ''
                        }`}
                      >
                        {l.title}
                      </button>
                    </li>
                  ))}
                  {lessons.length === 0 && (
                    <li className="text-gray-400 italic">No lessons</li>
                  )}
                </ul>
              </div>
            )
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="col-span-3 bg-white rounded-lg shadow p-6">
        {lesson ? (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">{lesson.title}</h2>
            {lesson.description && (
              <p className="text-gray-600">{lesson.description}</p>
            )}

            {lesson.content_type === 'video' && segments.length > 0 && (
              <div className="space-y-4">
                <div key={segments[currentSegmentIndex]?.id}>
                  <h4 className="text-sm font-medium mb-2">
                    Part {currentSegmentIndex + 1} of {segments.length}
                  </h4>
                  <MicroVideoPlayer
                    videoUrl={segments[currentSegmentIndex].video_url}
                    startTime={segments[currentSegmentIndex].start_time}
                    endTime={segments[currentSegmentIndex].end_time}
                    storageType={segments[currentSegmentIndex].storage_type}
                    onEnded={() => {
                      if (currentSegmentIndex < segments.length - 1) {
                        setCurrentSegmentIndex((i) => i + 1)
                      } else {
                        handleLessonComplete()
                      }
                    }}
                  />
                </div>
              </div>
            )}

            <div className="mt-6">
              <button
                onClick={handleLessonComplete}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Mark as Complete
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            Select a lesson to begin
          </div>
        )}
      </div>
    </div>
  )
}
