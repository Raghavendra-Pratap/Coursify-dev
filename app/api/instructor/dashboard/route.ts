import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { createServerClient as createServiceClient } from '@/lib/supabase'
import { getInstructorCourseIds } from '@/lib/instructor-course-access'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function periodDays(period: string): number {
  return period === '90days' ? 90 : period === '30days' ? 30 : 7
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}

export async function GET(request: Request) {
  if (!supabaseUrl || !supabaseAnonKey) return NextResponse.json({ error: 'Server config missing' }, { status: 500 })
  const cookieHeader = request.headers.get('cookie') ?? ''
  const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: { get(name: string) { const m = cookieHeader.match(new RegExp('(?:^|; )' + name + '=([^;]*)')); return m ? decodeURIComponent(m[1]) : undefined }, set() {}, remove() {} },
  })
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const url = new URL(request.url)
  const period = url.searchParams.get('period') ?? '7days'
  const periodDaysCount = periodDays(period)
  const now = new Date()
  const periodStart = new Date(now)
  periodStart.setDate(periodStart.getDate() - periodDaysCount)
  const prevStart = new Date(periodStart)
  prevStart.setDate(prevStart.getDate() - periodDaysCount)

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY required' }, { status: 500 })
  const db = createServiceClient()

  const { courseIds } = await getInstructorCourseIds(db, user.id)

  const empty = { stats: { learners: { current: 0, previous: 0, change: 0 }, courses: { current: 0, previous: 0, change: 0 }, completion: { current: 0, previous: 0, change: 0 }, avgTime: { current: 0, previous: 0, change: 0 } }, topCourses: [], weeklyData: [], recentActivity: [] }
  if (courseIds.length === 0) return NextResponse.json(empty)

  const [enrollmentsRes, coursesListRes, modulesRes] = await Promise.all([
    db.from('enrollments').select('id, course_id, user_id, completed_at, progress_percentage, enrolled_at').in('course_id', courseIds),
    db.from('courses').select('id, title, updated_at').in('id', courseIds).order('updated_at', { ascending: false }).limit(10),
    db.from('modules').select('id, course_id').in('course_id', courseIds),
  ])

  const allEnrollments = enrollmentsRes.data ?? []
  const enrollmentIds = allEnrollments.map((e: { id: string }) => e.id)
  const progressRes = enrollmentIds.length
    ? await db.from('progress').select('id, enrollment_id, lesson_id, completed_at, time_spent_seconds, completed').in('enrollment_id', enrollmentIds)
    : { data: [] }

  const myEnrollmentIds = new Set(enrollmentIds)
  const progressRows = progressRes.data ?? []
  const inPeriod = (iso: string | null | undefined, start: Date, end: Date) => {
    if (!iso) return false
    const d = new Date(iso)
    return d >= start && d <= end
  }

  const learnersCurrent = new Set(allEnrollments.filter((e: { enrolled_at?: string }) => inPeriod(e.enrolled_at, periodStart, now)).map((e: { user_id: string }) => e.user_id)).size
  const learnersPrev = new Set(allEnrollments.filter((e: { enrolled_at?: string }) => inPeriod(e.enrolled_at, prevStart, periodStart)).map((e: { user_id: string }) => e.user_id)).size
  const learnerCount = new Set(allEnrollments.map((e: { user_id: string }) => e.user_id)).size
  const totalCourses = courseIds.length
  const totalEnrollments = allEnrollments.length
  const completedEnrollments = allEnrollments.filter((e: { completed_at: string | null }) => e.completed_at != null).length
  const completionRate = totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0
  const completedPrev = allEnrollments.filter((e: { completed_at: string | null }) => inPeriod(e.completed_at, prevStart, periodStart)).length
  const completedCurrent = allEnrollments.filter((e: { completed_at: string | null }) => inPeriod(e.completed_at, periodStart, now)).length
  const completionPrevRate = totalEnrollments > 0 ? Math.round((completedPrev / totalEnrollments) * 100) : 0

  let totalTimeSeconds = 0, timeCount = 0, prevTimeSeconds = 0, prevTimeCount = 0
  progressRows.forEach((p: { time_spent_seconds?: number; completed_at?: string | null }) => {
    if (typeof p.time_spent_seconds === 'number' && p.time_spent_seconds > 0) {
      if (inPeriod(p.completed_at, periodStart, now)) { totalTimeSeconds += p.time_spent_seconds; timeCount++ }
      if (inPeriod(p.completed_at, prevStart, periodStart)) { prevTimeSeconds += p.time_spent_seconds; prevTimeCount++ }
    }
  })
  const avgTimeHours = timeCount > 0 ? Math.round((totalTimeSeconds / timeCount / 3600) * 10) / 10 : 0
  const avgTimePrev = prevTimeCount > 0 ? Math.round((prevTimeSeconds / prevTimeCount / 3600) * 10) / 10 : 0

  const enrollmentsByCourse: Record<string, { total: number; completed: number }> = {}
  allEnrollments.forEach((e: { course_id: string; completed_at: string | null }) => {
    if (!enrollmentsByCourse[e.course_id]) enrollmentsByCourse[e.course_id] = { total: 0, completed: 0 }
    enrollmentsByCourse[e.course_id].total++
    if (e.completed_at) enrollmentsByCourse[e.course_id].completed++
  })

  const moduleIds = (modulesRes.data ?? []).map((m: { id: string }) => m.id)
  const { data: lessons } = moduleIds.length ? await db.from('lessons').select('id, module_id, title').in('module_id', moduleIds) : { data: [] }
  const modToCourse: Record<string, string> = {}
  ;(modulesRes.data ?? []).forEach((m: { id: string; course_id: string }) => { modToCourse[m.id] = m.course_id })
  const lessonCompletion: Record<string, number> = {}
  progressRows.filter((p: { completed?: boolean }) => p.completed).forEach((p: { lesson_id: string }) => { lessonCompletion[p.lesson_id] = (lessonCompletion[p.lesson_id] ?? 0) + 1 })

  const courseTime: Record<string, { sec: number; n: number }> = {}
  progressRows.forEach((p: { enrollment_id: string; time_spent_seconds?: number }) => {
    const enr = allEnrollments.find((e: { id: string; course_id: string }) => e.id === p.enrollment_id)
    if (!enr || !p.time_spent_seconds) return
    courseTime[enr.course_id] = courseTime[enr.course_id] ?? { sec: 0, n: 0 }
    courseTime[enr.course_id].sec += p.time_spent_seconds
    courseTime[enr.course_id].n++
  })

  const topCourses = (coursesListRes.data ?? []).map((c: { id: string; title: string; updated_at: string }) => {
    const ec = enrollmentsByCourse[c.id] ?? { total: 0, completed: 0 }
    const ct = courseTime[c.id]
    const avgTimeStr = ct?.n ? `${Math.round((ct.sec / ct.n / 3600) * 10) / 10}h` : '-'
    const courseLessons = (lessons ?? []).filter((l: { module_id: string }) => modToCourse[l.module_id] === c.id)
    let dropOffPoint = '-'
    if (courseLessons.length && ec.total) {
      let minRate = 101
      courseLessons.forEach((l: { id: string; title: string }) => {
        const rate = Math.round(((lessonCompletion[l.id] ?? 0) / ec.total) * 100)
        if (rate < minRate) { minRate = rate; dropOffPoint = l.title }
      })
    }
    const completion = ec.total ? Math.round((ec.completed / ec.total) * 100) : 0
    return {
      id: c.id,
      name: c.title,
      completion,
      learners: ec.total,
      trend: completion >= 50 ? 'up' : 'down',
      trendValue: completion,
      avgTime: avgTimeStr,
      lastUpdated: new Date(c.updated_at).toLocaleDateString(),
      status: 'active',
      dropOffPoint,
    }
  })

  const byDay: Record<string, { completions: number; enrollments: number; timeSec: number; timeN: number }> = {}
  for (let i = 0; i < periodDaysCount; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - (periodDaysCount - 1 - i))
    byDay[d.toISOString().slice(0, 10)] = { completions: 0, enrollments: 0, timeSec: 0, timeN: 0 }
  }
  allEnrollments.forEach((e: { enrolled_at?: string }) => {
    const key = e.enrolled_at?.slice(0, 10)
    if (key && byDay[key]) byDay[key].enrollments++
  })
  progressRows.forEach((p: { completed_at: string | null; time_spent_seconds?: number }) => {
    const key = p.completed_at?.slice(0, 10)
    if (key && byDay[key]) {
      byDay[key].completions++
      if (p.time_spent_seconds) { byDay[key].timeSec += p.time_spent_seconds; byDay[key].timeN++ }
    }
  })
  const weeklyData = Object.keys(byDay).sort().map((day) => ({
    week: new Date(day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    completions: byDay[day].completions,
    enrollments: byDay[day].enrollments,
    avgTime: byDay[day].timeN ? Math.round((byDay[day].timeSec / byDay[day].timeN / 3600) * 10) / 10 : 0,
  }))

  const activityEnrollmentIds = Array.from(new Set(progressRows.map((p: { enrollment_id: string }) => p.enrollment_id)))
  const enrollmentsForActivity = allEnrollments.filter((e: { id: string }) => activityEnrollmentIds.includes(e.id))
  const enrollMap = new Map(enrollmentsForActivity.map((e: { id: string; user_id: string; course_id: string }) => [e.id, e]))
  const userIds = Array.from(new Set(enrollmentsForActivity.map((e: { user_id: string }) => e.user_id)))
  const { data: userProfiles } = userIds.length ? await db.from('user_profiles').select('id, full_name').in('id', userIds) : { data: [] }
  const userMap = new Map((userProfiles ?? []).map((u: { id: string; full_name: string | null }) => [u.id, u.full_name ?? 'Learner']))
  const courseIdsForActivity = Array.from(new Set(enrollmentsForActivity.map((e: { course_id: string }) => e.course_id)))
  const { data: courseTitles } = courseIdsForActivity.length ? await db.from('courses').select('id, title').in('id', courseIdsForActivity) : { data: [] }
  const courseMap = new Map((courseTitles ?? []).map((c: { id: string; title: string }) => [c.id, c.title]))

  const recentActivity = progressRows.filter((p: { completed_at: string | null }) => p.completed_at).sort((a: { completed_at: string }, b: { completed_at: string }) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()).slice(0, 10).map((p: { enrollment_id: string; completed_at: string | null }, i: number) => {
    const enr = enrollMap.get(p.enrollment_id)
    const userName = enr ? userMap.get(enr.user_id) ?? 'Learner' : 'Learner'
    const courseName = enr ? courseMap.get(enr.course_id) ?? 'Course' : 'Course'
    const initials = userName.split(/\s+/).map((s) => s[0]).join('').toUpperCase().slice(0, 2) || '?'
    return { id: i + 1, user: userName, action: 'completed a lesson', course: courseName, time: p.completed_at ? new Date(p.completed_at).toLocaleString() : '', avatar: initials, type: 'completion' }
  })

  return NextResponse.json({
    stats: {
      learners: { current: learnersCurrent || learnerCount, previous: learnersPrev, change: pctChange(learnersCurrent || learnerCount, learnersPrev) },
      courses: { current: totalCourses, previous: totalCourses, change: 0 },
      completion: { current: completionRate, previous: completionPrevRate, change: pctChange(completionRate, completionPrevRate) },
      avgTime: { current: avgTimeHours, previous: avgTimePrev, change: pctChange(avgTimeHours, avgTimePrev) },
    },
    topCourses,
    weeklyData,
    recentActivity,
  }, { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=60' } })
}
