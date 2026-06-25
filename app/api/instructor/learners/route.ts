import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { createServerClient as createServiceClient } from '@/lib/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/** GET: learners in instructor courses. Same course scope and enrollments source as Dashboard (owned + collaborated courses, enrollments table). */
export async function GET(request: Request) {
  if (!supabaseUrl || !supabaseAnonKey) return NextResponse.json({ error: 'Server config missing' }, { status: 500 })
  const cookieHeader = request.headers.get('cookie') ?? ''
  const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
        return match ? decodeURIComponent(match[1]) : undefined
      },
      set() {},
      remove() {},
    },
  })
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY required" }, { status: 500 })

  const db = createServiceClient()
  const { data: profile } = await db.from('user_profiles').select('role').eq('id', user.id).maybeSingle()
  const isAdmin = (profile as { role?: string } | null)?.role === 'admin'

  let courseIds: string[]
  if (isAdmin) {
    const { data: allCourses } = await db.from('courses').select('id')
    courseIds = (allCourses ?? []).map((c: { id: string }) => c.id)
  } else {
    const { data: owned } = await db.from('courses').select('id').eq('created_by', user.id)
    const { data: collab } = await db.from('course_collaborators').select('course_id').eq('user_id', user.id)
    const ownedIds = (owned ?? []).map((c: { id: string }) => c.id)
    const collabIds = (collab ?? []).map((c: { course_id: string }) => c.course_id)
    courseIds = Array.from(new Set([...ownedIds, ...collabIds]))
  }

  if (courseIds.length === 0) return NextResponse.json({ userIds: [], learnerStats: {}, learners: [], emptyReason: "no_courses" })

  // Enrollments for your courses (direct link, invite, ?enroll=). Prefer last_accessed_at, enrolled_at for Last active / Joined.
  let list: { id: string; user_id: string; course_id: string; progress_percentage?: number; completed_at: string | null; last_accessed_at?: string | null; enrolled_at?: string | null }[]
  const fullRes = await db.from('enrollments').select('id, course_id, user_id, completed_at, progress_percentage, last_accessed_at, enrolled_at').in('course_id', courseIds)
  if (fullRes.error) {
    const minRes = await db.from('enrollments').select('id, course_id, user_id, completed_at, progress_percentage').in('course_id', courseIds)
    if (minRes.error) return NextResponse.json({ error: minRes.error.message || 'Failed to load enrollments', learners: [] }, { status: 500 })
    list = (minRes.data ?? []).map((e: { id: string; user_id: string; course_id: string; progress_percentage?: number; completed_at: string | null }) => ({ ...e, last_accessed_at: null, enrolled_at: null }))
  } else {
    list = (fullRes.data ?? []) as typeof list
  }
  const userIds = Array.from(new Set(list.map((e: { user_id: string }) => e.user_id)))
  const enrollmentIds = list.map((e: { id: string }) => e.id)
  const enrollmentToUser = new Map<string, string>()
  list.forEach((e: { id: string; user_id: string }) => { enrollmentToUser.set(e.id, e.user_id) })
  let progressRows: { enrollment_id: string; time_spent_seconds?: number; quiz_score?: number | null }[] = []
  if (enrollmentIds.length > 0) {
    const { data: progress } = await db.from('progress').select('enrollment_id, time_spent_seconds, quiz_score').in('enrollment_id', enrollmentIds)
    progressRows = progress ?? []
  }
  const timeByUser: Record<string, number> = {}
  const scoresByUser: Record<string, number[]> = {}
  progressRows.forEach((p: { enrollment_id: string; time_spent_seconds?: number; quiz_score?: number | null }) => {
    const uid = enrollmentToUser.get(p.enrollment_id)
    if (!uid) return
    timeByUser[uid] = (timeByUser[uid] ?? 0) + (p.time_spent_seconds ?? 0)
    if (typeof p.quiz_score === 'number') { if (!scoresByUser[uid]) scoresByUser[uid] = []; scoresByUser[uid].push(p.quiz_score) }
  })
  function formatTimeSpent(totalSeconds: number): string {
    if (totalSeconds <= 0 || !Number.isFinite(totalSeconds)) return '0h'
    const h = Math.floor(totalSeconds / 3600)
    const m = Math.floor((totalSeconds % 3600) / 60)
    if (h > 0 && m > 0) return h + 'h ' + m + 'm'
    if (h > 0) return h + 'h'
    return m + 'm'
  }
  type Enr = { user_id: string; course_id: string; progress_percentage?: number; completed_at: string | null; last_accessed_at?: string | null; enrolled_at?: string | null }
  const statsByUser: Record<string, { enrolledCourses: number; completedCourses: number; totalProgress: number; lastActive: string; joinedDate: string; averageScore: number; totalTimeSpent: string; lastActivityAt: string | null }> = {}
  for (const u of userIds) {
    const userEnrollments = list.filter((e: Enr) => e.user_id === u)
    const completed = userEnrollments.filter((e: Enr) => e.completed_at != null).length
    const totalProgress = userEnrollments.length
      ? Math.round(
          userEnrollments.reduce((sum: number, e: Enr) => sum + (e.progress_percentage ?? 0), 0) / userEnrollments.length
        )
      : 0
    const lastDates = userEnrollments.map((e: Enr) => e.last_accessed_at).filter(Boolean) as string[]
    const enrolledDates = userEnrollments.map((e: Enr) => e.enrolled_at).filter(Boolean) as string[]
    const lastActiveDate = lastDates.length ? new Date(Math.max(...lastDates.map((d) => new Date(d).getTime()))) : null
    const lastActive = lastActiveDate ? lastActiveDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
    const lastActivityAt = lastActiveDate ? lastActiveDate.toISOString() : null
    const joinedDate = enrolledDates.length
      ? new Date(Math.min(...enrolledDates.map((d) => new Date(d).getTime()))).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '—'
    const totalSeconds = timeByUser[u] ?? 0
    const scores = scoresByUser[u] ?? []
    const averageScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
    statsByUser[u] = {
      enrolledCourses: userEnrollments.length,
      completedCourses: completed,
      totalProgress,
      lastActive,
      joinedDate,
      averageScore,
      totalTimeSpent: formatTimeSpent(totalSeconds),
      lastActivityAt,
    }
  }

  const { data: profiles } =
    userIds.length > 0
      ? await db.from('user_profiles').select('id, full_name, role, organization').in('id', userIds)
      : { data: [] }
  const profileById = new Map(
    ((profiles ?? []) as { id: string; full_name: string | null; role: string; organization: string | null }[]).map((p) => [p.id, p])
  )
  const emailById = new Map<string, string>()
  if (userIds.length > 0) {
    await Promise.all(userIds.map(async (id) => {
      try {
        const { data: { user: authUser } } = await db.auth.admin.getUserById(id)
        if (authUser?.email) emailById.set(id, authUser.email)
      } catch {
        // ignore per-user errors
      }
    }))
  }
  const learners = userIds.map((id) => {
    const p = profileById.get(id)
    const stats = statsByUser[id] ?? {
      enrolledCourses: 0,
      completedCourses: 0,
      totalProgress: 0,
      lastActive: '—',
      joinedDate: '—',
      averageScore: 0,
      totalTimeSpent: '0h',
      lastActivityAt: null,
    }
    return {
      id,
      full_name: p?.full_name ?? 'Learner',
      role: p?.role ?? 'learner',
      organization: p?.organization ?? null,
      email: emailById.get(id) ?? null,
      certificates: 0,
      ...stats,
    }
  })

  return NextResponse.json({ userIds, learnerStats: statsByUser, learners, emptyReason: userIds.length === 0 ? "no_enrollments" : undefined }, { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=60' } })
}

