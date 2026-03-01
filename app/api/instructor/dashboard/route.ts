import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { createServerClient as createServiceClient } from '@/lib/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export async function GET(request: Request) {
  if (!supabaseUrl || !supabaseAnonKey) return NextResponse.json({ error: 'Server config missing' }, { status: 500 })
  const cookieHeader = request.headers.get('cookie') ?? ''
  const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: { get(name: string) { const m = cookieHeader.match(new RegExp('(?:^|; )' + name + '=([^;]*)')); return m ? decodeURIComponent(m[1]) : undefined }, set() {}, remove() {} },
  })
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY required' }, { status: 500 })
  const db = createServiceClient()

  // Scope all data to instructor's courses (owned + collaborated); admin sees all courses
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

  if (courseIds.length === 0) {
    return NextResponse.json({
      stats: {
        learners: { current: 0, previous: 0, change: 0 },
        courses: { current: 0, previous: 0, change: 0 },
        completion: { current: 0, previous: 0, change: 0 },
        avgTime: { current: 0, previous: 0, change: 0 },
      },
      topCourses: [],
      weeklyData: [],
      recentActivity: [],
    })
  }

  const [enrollmentsRes, coursesListRes, progressRes] = await Promise.all([
    db.from('enrollments').select('id, course_id, user_id, completed_at, progress_percentage').in('course_id', courseIds),
    db.from('courses').select('id, title, updated_at').in('id', courseIds).order('updated_at', { ascending: false }).limit(10),
    db.from('progress').select('id, enrollment_id, completed_at, time_spent_seconds').eq('completed', true).order('completed_at', { ascending: false }).limit(500),
  ])

  const allEnrollments = enrollmentsRes.data ?? []
  const myEnrollmentIds = new Set(allEnrollments.map((e: { id: string }) => e.id))
  const progressRows = (progressRes.data ?? []).filter((p: { enrollment_id: string }) => myEnrollmentIds.has(p.enrollment_id))

  // learnerCount = unique user_ids from enrollments in instructor's courses
  const learnerCount = new Set(allEnrollments.map((e: { user_id: string }) => e.user_id)).size
  const totalCourses = courseIds.length
  const totalEnrollments = allEnrollments.length
  const completedEnrollments = allEnrollments.filter((e: { completed_at: string | null }) => e.completed_at != null).length
  const completionRate = totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0

  let totalTimeSeconds = 0, timeCount = 0
  progressRows.forEach((p: { time_spent_seconds?: number }) => {
    if (typeof p.time_spent_seconds === 'number' && p.time_spent_seconds > 0) {
      totalTimeSeconds += p.time_spent_seconds
      timeCount++
    }
  })
  const avgTimeHours = timeCount > 0 ? Math.round((totalTimeSeconds / timeCount / 3600) * 10) / 10 : 0

  const enrollmentsByCourse: Record<string, { total: number; completed: number }> = {}
  allEnrollments.forEach((e: { course_id: string; completed_at: string | null }) => {
    if (!enrollmentsByCourse[e.course_id]) enrollmentsByCourse[e.course_id] = { total: 0, completed: 0 }
    enrollmentsByCourse[e.course_id].total++
    if (e.completed_at) enrollmentsByCourse[e.course_id].completed++
  })

  const topCourses = (coursesListRes.data ?? []).map((c: { id: string; title: string; updated_at: string }) => {
    const ec = enrollmentsByCourse[c.id] ?? { total: 0, completed: 0 }
    return {
      id: c.id,
      name: c.title,
      completion: ec.total ? Math.round((ec.completed / ec.total) * 100) : 0,
      learners: ec.total,
      trend: 'up',
      trendValue: 0,
      avgTime: '—',
      lastUpdated: new Date(c.updated_at).toLocaleDateString(),
      status: 'active',
      dropOffPoint: '—',
    }
  })

  const completedByWeek: Record<string, number> = {}
  const now = new Date()
  for (let i = 0; i < 7; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - (6 - i))
    completedByWeek[d.toISOString().slice(0, 10)] = 0
  }
  progressRows.forEach((p: { completed_at: string | null }) => {
    if (p.completed_at && completedByWeek[p.completed_at.slice(0, 10)] !== undefined) {
      completedByWeek[p.completed_at.slice(0, 10)]++
    }
  })
  const weeklyData = Object.keys(completedByWeek)
    .sort()
    .map((week) => ({
      week: new Date(week).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      completions: completedByWeek[week] ?? 0,
      enrollments: 0,
      avgTime: 0,
    }))

  const enrollmentIds = Array.from(new Set(progressRows.map((p: { enrollment_id: string }) => p.enrollment_id)))
  const { data: enrollmentsForActivity } =
    enrollmentIds.length > 0 ? await db.from('enrollments').select('id, user_id, course_id').in('id', enrollmentIds) : { data: [] }
  const enrollMap = new Map((enrollmentsForActivity ?? []).map((e: { id: string; user_id: string; course_id: string }) => [e.id, e]))
  const userIds = Array.from(new Set((enrollmentsForActivity ?? []).map((e: { user_id: string }) => e.user_id)))
  const { data: userProfiles } = userIds.length ? await db.from('user_profiles').select('id, full_name').in('id', userIds) : { data: [] }
  const userMap = new Map((userProfiles ?? []).map((u: { id: string; full_name: string | null }) => [u.id, u.full_name ?? 'Learner']))
  const courseIdsForActivity = Array.from(new Set((enrollmentsForActivity ?? []).map((e: { course_id: string }) => e.course_id)))
  const { data: courseTitles } = courseIdsForActivity.length ? await db.from('courses').select('id, title').in('id', courseIdsForActivity) : { data: [] }
  const courseMap = new Map((courseTitles ?? []).map((c: { id: string; title: string }) => [c.id, c.title]))

  const recentActivity = progressRows.slice(0, 10).map((p: { enrollment_id: string; completed_at: string | null }, i: number) => {
    const enr = enrollMap.get(p.enrollment_id)
    const userName = enr ? userMap.get(enr.user_id) ?? 'Learner' : 'Learner'
    const courseName = enr ? courseMap.get(enr.course_id) ?? 'Course' : 'Course'
    const initials = userName.split(/\s+/).map((s) => s[0]).join('').toUpperCase().slice(0, 2) || '?'
    return {
      id: i + 1,
      user: userName,
      action: 'completed a lesson',
      course: courseName,
      time: p.completed_at ? new Date(p.completed_at).toLocaleString() : '',
      avatar: initials,
      type: 'completion',
    }
  })

  return NextResponse.json({
    stats: {
      learners: { current: learnerCount, previous: Math.max(0, learnerCount - 50), change: 0 },
      courses: { current: totalCourses, previous: Math.max(0, totalCourses - 2), change: 0 },
      completion: { current: completionRate, previous: Math.max(0, completionRate - 10), change: 0 },
      avgTime: { current: avgTimeHours, previous: Math.max(0, avgTimeHours - 1), change: 0 },
    },
    topCourses,
    weeklyData,
    recentActivity,
  })
}
