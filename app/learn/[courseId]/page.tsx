'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { BookOpen, ChevronLeft, CheckCircle, FileText } from 'lucide-react'

type Lesson = { id: string; title: string; description: string | null; order_index: number }
type Module = { id: string; title: string; order_index: number; lessons: Lesson[] }
type Course = { id: string; title: string; description: string | null }
type Content = { course: Course; modules: Module[] }

export default function LearnCoursePage() {
  const params = useParams()
  const courseId = typeof params.courseId === 'string' ? params.courseId : (params.courseId as string[])?.[0]
  const [content, setContent] = useState<Content | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null)

  useEffect(() => {
    if (!courseId) {
      setLoading(false)
      setError('Invalid course')
      return
    }
    let cancelled = false
    fetch(`/api/learning/courses/${encodeURIComponent(courseId)}/content`, { credentials: 'include', cache: 'no-store' })
      .then((res) => {
        if (cancelled) return
        if (res.status === 401) {
          setError('Please sign in to view this course.')
          return res.json().catch(() => ({}))
        }
        if (res.status === 403) {
          setError('You are not enrolled in this course.')
          return res.json().catch(() => ({}))
        }
        if (res.status === 404) {
          setError('Course not found or not published.')
          return res.json().catch(() => ({}))
        }
        if (!res.ok) {
          setError('Could not load course content.')
          return res.json().catch(() => ({}))
        }
        return res.json()
      })
      .then((data: Content) => {
        if (cancelled || !data) return
        setContent(data)
        setError(null)
        const firstLesson = data.modules[0]?.lessons?.[0]
        if (firstLesson && !selectedLessonId) setSelectedLessonId(firstLesson.id)
      })
      .catch(() => {
        if (!cancelled) setError('Something went wrong.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [courseId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Loading course…</p>
      </div>
    )
  }

  if (error || !content) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 max-w-md text-center">
          <p className="text-gray-700 dark:text-gray-300 font-medium mb-4">{error ?? 'Course unavailable'}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline font-semibold"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Coursify
          </Link>
        </div>
      </div>
    )
  }

  const selectedLesson = content.modules.flatMap((m) => m.lessons).find((l) => l.id === selectedLessonId)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm font-medium"
        >
          <ChevronLeft className="w-4 h-4" />
          My learning
        </Link>
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">{content.course.title}</h1>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <aside className="w-72 shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Course content</h2>
            <div className="space-y-4">
              {content.modules.map((mod) => (
                <div key={mod.id}>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{mod.title}</h3>
                  <ul className="space-y-1">
                    {mod.lessons.map((l) => (
                      <li key={l.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedLessonId(l.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                            selectedLessonId === l.id
                              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          <FileText className="w-4 h-4 shrink-0" />
                          <span className="truncate">{l.title}</span>
                        </button>
                      </li>
                    ))}
                    {mod.lessons.length === 0 && (
                      <li className="text-gray-400 dark:text-gray-500 text-xs italic px-3">No lessons</li>
                    )}
                  </ul>
                </div>
              ))}
              {content.modules.length === 0 && (
                <p className="text-gray-500 dark:text-gray-400 text-sm">No modules yet.</p>
              )}
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-6">
          {selectedLesson ? (
            <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{selectedLesson.title}</h2>
              {selectedLesson.description && (
                <p className="text-gray-600 dark:text-gray-400 mb-6">{selectedLesson.description}</p>
              )}
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span>Complete this lesson when you are done. Progress is saved.</span>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
              <FileText className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Select a lesson from the sidebar to start.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
