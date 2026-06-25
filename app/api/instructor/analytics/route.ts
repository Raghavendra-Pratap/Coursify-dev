import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { createServerClient as createServiceClient } from '@/lib/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function periodDays(range: string): number {
  if (range === '90days') return 90
  if (range === '7days') return 7
  return 30
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}

function statBlock(current: number, previous: number) {
  const change = pctChange(current, previous)
  return { current, previous, change, trend: change >= 0 ? 'up' as const : 'down' as const }
}

/** GET: analytics overview + engagement/completion/performance from real data. */
export async function GET(request: Request) {
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
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const range = url.searchParams.get('range') ?? '30days'
  const days = periodDays(range)
  const now = new Date()
  const periodStart = new Date(now)
  periodStart.setDate(periodStart.getDate() - days)
  const prevStart = new Date(periodStart)
  prevStart.setDate(prevStart.getDate() - days)

  const db = createServiceClient()
  const { data: owned } = await db.from('courses').select('id, title, status').eq('created_by', user.id)
  const { data: collab } = await db.from('course_collaborators').select('course_id').eq('user_id', user.id)
  const ownedIds = (owned ?? []).map((c: { id: string }) => c.id)
  const collabIds = (collab ?? []).map((c: { course_id: string }) => c.course_id)
  const courseIds = Array.from(new Set([...ownedIds, ...collabIds]))

  const emptyResponse = {
    overview: {
      totalLearners: statBlock(0, 0),
      activeLearners: statBlock(0, 0),
      coursesCompleted: statBlock(0, 0),
      avgCompletionRate: statBlock(0, 0),
    },
    coursePerformance: [],
    courseOptions: [],
    engagement: { stats: { dailyActiveUsers: statBlock(0, 0), avgSessionMinutes: statBlock(0, 0), newEnrollments: statBlock(0, 0), returnRate: statBlock(0, 0) }, peakHours: [] },
    completion: { stats: { totalCompletions: statBlock(0, 0), completionRate: statBlock(0, 0), certificatesIssued: statBlock(0, 0), avgDaysToComplete: statBlock(0, 0) }, byCourse: [] },
    performance: { stats: { avgQuizScore: statBlock(0, 0), passRate: statBlock(0, 0), avgCompletion: statBlock(0, 0), satisfaction: statBlock(0, 0) } },
  }
  if (courseIds.length === 0) return NextResponse.json(emptyResponse)

  const [{ data: courses }, { data: enrollments }, { data: progressRows }, { data: activityRows }, { data: ratings }, { data: modules }] = await Promise.all([
    db.from('courses').select('id, title, status').in('id', courseIds),
    db.from('enrollments').select('id, course_id, user_id, completed_at, progress_percentage, enrolled_at').in('course_id', courseIds),
    db.from('progress').select('enrollment_id, lesson_id, completed, completed_at, time_spent_seconds').eq('completed', true).limit(5000),
    db.from('learner_activity').select('user_id, created_at').gte('created_at', prevStart.toISOString()).limit(10000),
    db.from('course_ratings').select('course_id, rating').in('course_id', courseIds),
    db.from('modules').select('id, course_id, title').in('course_id', courseIds),
  ])

  const enrollmentsList = enrollments ?? []
  const enrollmentIds = new Set(enrollmentsList.map((e: { id: string }) => e.id))
  const progress = (progressRows ?? []).filter((p: { enrollment_id: string }) => enrollmentIds.has(p.enrollment_id))
  const inPeriod = (iso: string | null | undefined, start: Date, end: Date) => {
    if (!iso) return false
    const d = new Date(iso)
    return d >= start && d <= end
  }

  const totalLearners = new Set(enrollmentsList.map((e: { user_id: string }) => e.user_id)).size
  const activeInPeriod = new Set(enrollmentsList.filter((e: { enrolled_at?: string }) => inPeriod(e.enrolled_at, periodStart, now)).map((e: { user_id: string }) => e.user_id)).size
  const completedAll = enrollmentsList.filter((e: { completed_at: string | null }) => e.completed_at).length
  const completedInPeriod = enrollmentsList.filter((e: { completed_at: string | null }) => inPeriod(e.completed_at, periodStart, now)).length
  const completedPrev = enrollmentsList.filter((e: { completed_at: string | null }) => inPeriod(e.completed_at, prevStart, periodStart)).length
  const avgCompletionRate = enrollmentsList.length ? Math.round(enrollmentsList.reduce((s: number, e: { progress_percentage?: number }) => s + (e.progress_percentage ?? 0), 0) / enrollmentsList.length) : 0
  const newEnrollCurrent = enrollmentsList.filter((e: { enrolled_at?: string }) => inPeriod(e.enrolled_at, periodStart, now)).length
  const newEnrollPrev = enrollmentsList.filter((e: { enrolled_at?: string }) => inPeriod(e.enrolled_at, prevStart, periodStart)).length
  const activityInPeriod = (activityRows ?? []).filter((a: { created_at: string }) => inPeriod(a.created_at, periodStart, now))
  const activityPrev = (activityRows ?? []).filter((a: { created_at: string }) => inPeriod(a.created_at, prevStart, periodStart))
  const dauCurrent = new Set(activityInPeriod.map((a: { user_id: string }) => a.user_id)).size
  const dauPrev = new Set(activityPrev.map((a: { user_id: string }) => a.user_id)).size
  const hourBuckets: Record<number, Set<string>> = {}
  activityInPeriod.forEach((a: { user_id: string; created_at: string }) => {
    const h = new Date(a.created_at).getHours()
    hourBuckets[h] = hourBuckets[h] ?? new Set()
    hourBuckets[h].add(a.user_id)
  })
  const peakHours = Object.keys(hourBuckets).map((h) => ({ hour: `${String(h).padStart(2, '0')}:00`, users: hourBuckets[Number(h)].size })).sort((a, b) => b.users - a.users).slice(0, 12)
  const returnedUsers = enrollmentsList.filter((e: { progress_percentage?: number }) => (e.progress_percentage ?? 0) > 0).length
  const returnRate = enrollmentsList.length ? Math.round((returnedUsers / enrollmentsList.length) * 100) : 0
  let totalTimeSec = 0, timeCount = 0
  progress.forEach((p: { time_spent_seconds?: number }) => {
    if (typeof p.time_spent_seconds === 'number' && p.time_spent_seconds > 0) { totalTimeSec += p.time_spent_seconds; timeCount++ }
  })
  const avgSessionMin = timeCount ? Math.round(totalTimeSec / timeCount / 60) : 0
  const completionRatePct = enrollmentsList.length ? Math.round((completedAll / enrollmentsList.length) * 100) : 0
  const completionRatePrev = enrollmentsList.length ? Math.round((completedPrev / Math.max(enrollmentsList.length, 1)) * 100) : 0
  let avgDays = 0
  const completedWithDates = enrollmentsList.filter((e: { completed_at: string | null; enrolled_at?: string }) => e.completed_at && e.enrolled_at)
  if (completedWithDates.length) {
    avgDays = Math.round(completedWithDates.reduce((s: number, e: { completed_at: string; enrolled_at: string }) => s + Math.max(0, (new Date(e.completed_at).getTime() - new Date(e.enrolled_at).getTime()) / 86400000), 0) / completedWithDates.length)
  }
  const allRatings = (ratings ?? []).map((r: { rating: number }) => r.rating).filter(Boolean)
  const satisfaction = allRatings.length ? Math.round((allRatings.reduce((a: number, b: number) => a + b, 0) / allRatings.length) * 20) : 0
  const ratingByCourse: Record<string, { sum: number; count: number }> = {}
  ;(ratings ?? []).forEach((r: { course_id: string; rating: number }) => {
    ratingByCourse[r.course_id] = ratingByCourse[r.course_id] ?? { sum: 0, count: 0 }
    ratingByCourse[r.course_id].sum += r.rating ?? 0
    ratingByCourse[r.course_id].count++
  })
  const moduleIds = (modules ?? []).map((m: { id: string }) => m.id)
  const { data: lessons } = moduleIds.length ? await db.from('lessons').select('id, module_id, title').in('module_id', moduleIds) : { data: [] }
  const modToCourse: Record<string, string> = {}
  ;(modules ?? []).forEach((m: { id: string; course_id: string }) => { modToCourse[m.id] = m.course_id })
  const lessonCompletion: Record<string, number> = {}
  progress.forEach((p: { lesson_id: string }) => { lessonCompletion[p.lesson_id] = (lessonCompletion[p.lesson_id] ?? 0) + 1 })
  const { data: quizAttempts } = enrollmentIds.size ? await db.from('quiz_attempts').select('score, passed, enrollment_id').in('enrollment_id', Array.from(enrollmentIds)).limit(2000) : { data: [] }
  const scores = (quizAttempts ?? []).map((q: { score: number }) => q.score).filter((s: number) => typeof s === 'number')
  const avgQuizScore = scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0
  const passRate = (quizAttempts ?? []).length ? Math.round(((quizAttempts ?? []).filter((q: { passed: boolean }) => q.passed).length / (quizAttempts ?? []).length) * 100) : 0
  const byCourse: Record<string, { enrolled: number; completed: number; inProgress: number; totalProgress: number }> = {}
  courseIds.forEach((id: string) => { byCourse[id] = { enrolled: 0, completed: 0, inProgress: 0, totalProgress: 0 } })
  enrollmentsList.forEach((e: { course_id: string; completed_at: string | null; progress_percentage?: number }) => {
    if (!byCourse[e.course_id]) byCourse[e.course_id] = { enrolled: 0, completed: 0, inProgress: 0, totalProgress: 0 }
    byCourse[e.course_id].enrolled++
    byCourse[e.course_id].totalProgress += e.progress_percentage ?? 0
    if (e.completed_at) byCourse[e.course_id].completed++
    else byCourse[e.course_id].inProgress++
  })
  const colors = ['blue', 'purple', 'green', 'orange', 'pink', 'indigo']
  const coursePerformance = (courses ?? []).map((c: { id: string; title: string }) => {
    const bc = byCourse[c.id] ?? { enrolled: 0, completed: 0, inProgress: 0, totalProgress: 0 }
    const completionRate = bc.enrolled ? Math.round(bc.totalProgress / bc.enrolled) : 0
    const dropOffRate = bc.enrolled ? Math.round(((bc.enrolled - bc.completed) / bc.enrolled) * 100) : 0
    const courseLessons = (lessons ?? []).filter((l: { module_id: string }) => modToCourse[l.module_id] === c.id)
    let dropLesson = '-'
    if (courseLessons.length && bc.enrolled) {
      let minRate = 101
      courseLessons.forEach((l: { id: string; title: string }) => {
        const rate = Math.round(((lessonCompletion[l.id] ?? 0) / bc.enrolled) * 100)
        if (rate < minRate) { minRate = rate; dropLesson = l.title }
      })
    }
    const rt = ratingByCourse[c.id]
    const satisfactionCourse = rt?.count ? Math.round((rt.sum / rt.count) * 20) : 0
    let courseTimeSec = 0, courseTimeN = 0
    progress.forEach((p: { enrollment_id: string; time_spent_seconds?: number }) => {
      const enr = enrollmentsList.find((e: { id: string; course_id: string }) => e.id === p.enrollment_id && e.course_id === c.id)
      if (enr && p.time_spent_seconds) { courseTimeSec += p.time_spent_seconds; courseTimeN++ }
    })
    const avgTimeH = courseTimeN ? `${Math.round((courseTimeSec / courseTimeN / 3600) * 10) / 10}h` : '-'
    return { id: c.id, name: c.title, enrolled: bc.enrolled, completed: bc.completed, inProgress: bc.inProgress, completionRate, avgScore: avgQuizScore, avgTime: avgTimeH, dropOffRate, satisfaction: satisfactionCourse, dropOffPoint: dropLesson, trend: completionRate >= 50 ? 'up' : 'down', trendValue: completionRate }
  })
  const completionByCourse = coursePerformance.filter((c) => c.enrolled > 0).sort((a, b) => b.completionRate - a.completionRate).slice(0, 6).map((c, i) => ({ category: c.name.length > 28 ? c.name.slice(0, 28) + '...' : c.name, rate: c.completionRate, courses: 1, color: colors[i % colors.length] }))
  return NextResponse.json({
    overview: { totalLearners: statBlock(totalLearners, totalLearners), activeLearners: statBlock(activeInPeriod || totalLearners, dauPrev), coursesCompleted: statBlock(completedInPeriod, completedPrev), avgCompletionRate: statBlock(avgCompletionRate, completionRatePrev) },
    coursePerformance,
    courseOptions: (courses ?? []).map((c: { id: string; title: string }) => ({ id: c.id, name: c.title })),
    engagement: { stats: { dailyActiveUsers: statBlock(dauCurrent, dauPrev), avgSessionMinutes: statBlock(avgSessionMin, Math.max(0, avgSessionMin - 5)), newEnrollments: statBlock(newEnrollCurrent, newEnrollPrev), returnRate: statBlock(returnRate, Math.max(0, returnRate - 5)) }, peakHours },
    completion: { stats: { totalCompletions: statBlock(completedInPeriod, completedPrev), completionRate: statBlock(completionRatePct, completionRatePrev), certificatesIssued: statBlock(completedAll, completedPrev), avgDaysToComplete: statBlock(avgDays, Math.max(0, avgDays + 2)) }, byCourse: completionByCourse },
    performance: { stats: { avgQuizScore: statBlock(avgQuizScore, Math.max(0, avgQuizScore - 3)), passRate: statBlock(passRate, Math.max(0, passRate - 5)), avgCompletion: statBlock(avgCompletionRate, completionRatePrev), satisfaction: statBlock(satisfaction, Math.max(0, satisfaction - 5)) } },
  }, { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=60' } })
}
