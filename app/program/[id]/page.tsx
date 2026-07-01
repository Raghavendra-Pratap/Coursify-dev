'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CourseInviteAuthGate } from '@/components/CourseInviteAuthGate'
import { CourseInviteBoardingPass } from '@/components/CourseInviteBoardingPass'
import { supabase } from '@/lib/supabase'
import { persistSessionMode, stashLandingIntent } from '@/lib/session-mode'

type Program = {
  id: string
  title: string
  description: string | null
  inviterName?: string
  courses: { id: string; title: string }[]
  courseCount?: number
  moduleCount?: number
  lessonCount?: number
  durationLabel?: string
}

function displayNameFromUser(user: {
  id: string
  email?: string
  user_metadata?: Record<string, unknown>
}): string | undefined {
  const meta = user.user_metadata
  const fromMeta =
    (typeof meta?.full_name === 'string' && meta.full_name.trim()) ||
    (typeof meta?.name === 'string' && meta.name.trim())
  return fromMeta || undefined
}

export default function ProgramPage({ params }: { params: { id: string } }) {
  const [program, setProgram] = useState<Program | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [signedIn, setSignedIn] = useState(false)
  const [userEmail, setUserEmail] = useState<string | undefined>()
  const [userName, setUserName] = useState<string | undefined>()
  const [enrolling, setEnrolling] = useState(false)
  const [enrollError, setEnrollError] = useState<string | null>(null)
  const [autoEnrolled, setAutoEnrolled] = useState<boolean | null>(null)

  const id = typeof params.id === 'string' ? params.id : (params as unknown as { id: string }).id
  const signInHref = `/program/${encodeURIComponent(id)}`

  useEffect(() => {
    stashLandingIntent('learner')
  }, [])

  useEffect(() => {
    if (!id) {
      setLoading(false)
      setError('Invalid program link.')
      return
    }
    async function load() {
      try {
        const [programRes, sessionRes] = await Promise.all([
          fetch(`/api/programs/${encodeURIComponent(id)}`, { credentials: 'include' }),
          fetch('/api/auth/session', { credentials: 'include' }),
        ])
        const data = await programRes.json().catch(() => ({}))
        if (!programRes.ok) {
          setError(data?.error ?? (programRes.status === 404 ? 'Program not found.' : 'Could not load program.'))
          setProgram(null)
        } else {
          setProgram(data as Program)
        }
        const sessionData = await sessionRes.json().catch(() => ({}))
        const user = sessionData?.session?.user
        if (user?.id) {
          setSignedIn(true)
          setUserEmail(user.email ?? undefined)
          const metaName = displayNameFromUser(user)
          setUserName(metaName)
          if (!metaName) {
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('full_name')
              .eq('id', user.id)
              .maybeSingle()
            const profileName = (profile as { full_name?: string | null } | null)?.full_name?.trim()
            if (profileName) setUserName(profileName)
          }
        } else {
          setSignedIn(false)
          setUserEmail(undefined)
          setUserName(undefined)
        }
      } catch {
        setError('Something went wrong.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  useEffect(() => {
    if (!id || !signedIn || !program || autoEnrolled !== null) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/programs/' + encodeURIComponent(id) + '/enroll', { method: 'POST', credentials: 'include' })
        if (cancelled) return
        if (res.ok) {
          const sessionData = await fetch('/api/auth/session', { credentials: 'include' }).then((r) => r.json()).catch(() => ({}))
          const userId = sessionData?.session?.user?.id as string | undefined
          await persistSessionMode('learner', userId)
          setAutoEnrolled(true)
        } else setAutoEnrolled(false)
      } catch {
        if (!cancelled) setAutoEnrolled(false)
      }
    })()
    return () => { cancelled = true }
  }, [id, signedIn, program, autoEnrolled])

  const handleEnroll = async () => {
    setEnrollError(null)
    setEnrolling(true)
    try {
      const res = await fetch(`/api/programs/${encodeURIComponent(id)}/enroll`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setEnrollError(data?.error || 'Enrollment failed')
        return
      }
      const sessionData = await fetch('/api/auth/session', { credentials: 'include' }).then((r) => r.json()).catch(() => ({}))
      const userId = sessionData?.session?.user?.id as string | undefined
      await persistSessionMode('learner', userId)
      window.location.href = '/'
    } catch {
      setEnrollError('Something went wrong.')
    } finally {
      setEnrolling(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1018] flex items-center justify-center">
        <p className="text-[#7A8FA3] tracking-wide">Loading your program invitation…</p>
      </div>
    )
  }

  if (error && !program) {
    return (
      <div className="min-h-screen bg-[#0B1018] flex items-center justify-center p-4">
        <div className="bg-[#121A24] border border-[#243040] rounded-2xl p-8 max-w-md text-center">
          <p className="text-[#F4F7FA] font-medium mb-4">{error}</p>
          <Link href="/" className="text-[#E8A87C] hover:text-[#C67B4E] font-semibold transition-colors">
            ← Back to Coursify
          </Link>
        </div>
      </div>
    )
  }

  if (!program) return null

  if (!signedIn) {
    return (
      <CourseInviteAuthGate
        programId={program.id}
        courseTitle={program.title}
        inviterName={program.inviterName}
      />
    )
  }

  return (
    <CourseInviteBoardingPass
      variant="program"
      courseTitle={program.title}
      courseId={program.id}
      description={program.description}
      inviterName={program.inviterName}
      recipientEmail={userEmail}
      recipientName={userName}
      moduleCount={program.moduleCount}
      lessonCount={program.lessonCount}
      durationLabel={program.durationLabel}
      programCourses={program.courses}
      signedIn={signedIn}
      enrolling={enrolling}
      enrollError={enrollError}
      autoEnrolled={autoEnrolled}
      onEnroll={handleEnroll}
      signInHref={signInHref}
    />
  )
}
