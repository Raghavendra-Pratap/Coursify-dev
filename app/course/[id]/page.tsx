'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BookOpen, ArrowRight, Loader2 } from 'lucide-react'

type Course = { id: string; title: string; description: string | null; status: string }

export default function CoursePage({ params }: { params: { id: string } }) {
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [signedIn, setSignedIn] = useState(false)
  const [enrolling, setEnrolling] = useState(false)
  const [enrollError, setEnrollError] = useState<string | null>(null)
  const [autoEnrolled, setAutoEnrolled] = useState<boolean | null>(null)

  const id = typeof params.id === 'string' ? params.id : (params as unknown as { id: string }).id

  useEffect(() => {
    if (!id) {
      setLoading(false)
      setError('Invalid course link.')
      return
    }
    async function load() {
      try {
        const [courseRes, sessionRes] = await Promise.all([
          fetch(`/api/courses/${encodeURIComponent(id)}`, { credentials: 'include' }),
          fetch('/api/auth/session', { credentials: 'include' }),
        ])
        const data = await courseRes.json().catch(() => ({}))
        if (!courseRes.ok) {
          setError(data?.error ?? (courseRes.status === 404 ? 'Course not found.' : 'Could not load course.'))
          setCourse(null)
        } else {
          setCourse(data as Course)
        }
        const sessionData = await sessionRes.json().catch(() => ({}))
        setSignedIn(!!sessionData?.session?.user)
      } catch {
        setError('Something went wrong.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  // Auto-enroll when signed-in user visits course link directly (so they count as "enrolled via link")
  useEffect(() => {
    if (!id || !signedIn || !course || course.status !== 'published' || autoEnrolled !== null) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/courses/' + encodeURIComponent(id) + '/enroll', { method: 'POST', credentials: 'include' })
        if (cancelled) return
        if (res.ok) setAutoEnrolled(true)
        else setAutoEnrolled(false)
      } catch {
        if (!cancelled) setAutoEnrolled(false)
      }
    })()
    return () => { cancelled = true }
  }, [id, signedIn, course, autoEnrolled])

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
          {signedIn ? (
            <>
              {autoEnrolled === true ? (
                <div className="rounded-xl bg-green-50 border border-green-200 p-4 mb-4">
                  <p className="font-semibold text-green-800 mb-2">You&apos;re enrolled</p>
                  <p className="text-sm text-green-700 mb-3">You can start this course in Coursify.</p>
                  <Link href="/" className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700">
                    Open Coursify <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : (
              <button
                type="button"
                disabled={enrolling || (autoEnrolled === false && !enrollError)}
                onClick={async () => {
                  setEnrollError(null)
                  setEnrolling(true)
                  try {
                    const res = await fetch(`/api/courses/${encodeURIComponent(id)}/enroll`, {
                      method: 'POST',
                      credentials: 'include',
                    })
                    const data = await res.json().catch(() => ({}))
                    if (!res.ok) {
                      setEnrollError(data?.error || 'Enrollment failed')
                      return
                    }
                    if (typeof window !== 'undefined') {
                      window.localStorage.setItem('coursify_session_mode', 'learner')
                    }
                    window.location.href = '/'
                  } catch {
                    setEnrollError('Something went wrong.')
                  } finally {
                    setEnrolling(false)
                  }
                }}
                className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-70"
              >
                {enrolling ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {enrolling ? 'Enrolling…' : 'Enroll in this course'}
                <ArrowRight className="w-4 h-4" />
              </button>
              {enrollError && <p className="mt-2 text-sm text-red-600">{enrollError}</p>}
              )}
            </>
          ) : (
            <Link
              href={`/?enroll=${encodeURIComponent(id)}`}
              className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
            >
              Go to Coursify to enroll
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
