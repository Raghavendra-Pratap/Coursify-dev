'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { BookOpen, ArrowRight } from 'lucide-react'

type Course = { id: string; title: string; description: string | null; status: string }

export default function CoursePage({ params }: { params: { id: string } }) {
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const id = typeof params.id === 'string' ? params.id : (params as unknown as { id: string }).id
    if (!id) {
      setLoading(false)
      setError('Invalid course link.')
      return
    }
    async function load() {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        setError('App not configured.')
        setLoading(false)
        return
      }
      try {
        const { data, error: e } = await supabase
          .from('courses')
          .select('id, title, description, status')
          .eq('id', id)
          .maybeSingle()
        if (e) {
          setError('Could not load course.')
          setCourse(null)
        } else if (data) {
          setCourse(data as Course)
          if ((data as Course).status !== 'published') setError('This course is not published yet.')
        } else {
          setError('Course not found.')
        }
      } catch {
        setError('Something went wrong.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.id])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading course…</p>
      </div>
    )
  }

  if (error && !course) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <p className="text-gray-700 font-medium mb-4">{error}</p>
          <Link href="/" className="text-blue-600 hover:underline font-semibold">
            ← Back to Coursify
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{course?.title ?? 'Course'}</h1>
              {course?.status === 'published' && (
                <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded">Published</span>
              )}
            </div>
          </div>
          {course?.description && (
            <p className="text-gray-600 mb-6">{course.description}</p>
          )}
          {error && course?.status !== 'published' && (
            <p className="text-amber-700 bg-amber-50 rounded-lg p-3 text-sm mb-6">{error}</p>
          )}
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            Go to Coursify to enroll
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
