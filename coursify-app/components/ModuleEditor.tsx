'use client'

import { useState, useEffect } from 'react'
import type { Module, Lesson, VideoSegment } from '@/lib/types'
import { LessonEditor } from './LessonEditor'
import { createClient } from '@/lib/supabase-client'

interface ModuleEditorProps {
  module: Module
  courseId: string
}

export function ModuleEditor({ module, courseId }: ModuleEditorProps) {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadLessons()
  }, [module.id])

  const loadLessons = async () => {
    try {
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('module_id', module.id)
        .order('order_index')

      if (error) throw error
      if (data) {
        setLessons(data)
        if (data.length > 0 && !selectedLesson) {
          setSelectedLesson(data[0].id)
        }
      }
    } catch (err) {
      console.error('Error loading lessons:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddLesson = async () => {
    const lessonTitle = prompt('Enter lesson title:')
    if (!lessonTitle) return

    try {
      const maxOrder = lessons.length > 0
        ? Math.max(...lessons.map(l => l.order_index))
        : -1

      const { data, error } = await supabase
        .from('lessons')
        .insert({
          module_id: module.id,
          title: lessonTitle,
          content_type: 'video',
          order_index: maxOrder + 1,
        })
        .select()
        .single()

      if (error) throw error
      if (data) {
        setLessons([...lessons, data])
        setSelectedLesson(data.id)
      }
    } catch (err) {
      console.error('Error adding lesson:', err)
      alert('Failed to add lesson')
    }
  }

  if (loading) {
    return <div className="bg-white rounded-lg shadow p-8">Loading...</div>
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">{module.title}</h2>
        {module.description && (
          <p className="text-gray-600 text-sm mt-1">{module.description}</p>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4">
        {/* Lesson List */}
        <div className="col-span-1 border-r pr-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-medium">Lessons</h3>
            <button
              onClick={handleAddLesson}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              + Add
            </button>
          </div>
          <div className="space-y-1">
            {lessons.map((lesson) => (
              <button
                key={lesson.id}
                onClick={() => setSelectedLesson(lesson.id)}
                className={`w-full text-left px-2 py-1 text-sm rounded ${
                  selectedLesson === lesson.id
                    ? 'bg-blue-100 border border-blue-300'
                    : 'hover:bg-gray-50'
                }`}
              >
                {lesson.title}
              </button>
            ))}
          </div>
        </div>

        {/* Lesson Editor */}
        <div className="col-span-3">
          {selectedLesson ? (
            <LessonEditor
              lesson={lessons.find(l => l.id === selectedLesson)!}
              moduleId={module.id}
            />
          ) : (
            <div className="text-center text-gray-500 py-8">
              Select a lesson to edit, or create a new one
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
