import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { createServerClient as createServiceClient } from '@/lib/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/** GET: overview stats and course performance for instructor (owned + collaborated courses). */
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

  const db = createServiceClient()
  const { data: owned } = await db.from('courses').select('id').eq('created_by', user.id)
  const { data: collab } = await db.from('course_collaborators').select('course_id').eq('user_id', user.id)
  const ownedIds = (owned ?? []).map((c: { id: string }) => c.id)
  const collabIds = (collab ?? []).map((c: { course_id: string }) => c.course_id)
  const courseIds = Array.from(new Set([...ownedIds, ...collabIds]))

  if (courseIds.length === 0) {
    return NextResponse.json({
      overview: { totalLearners: 0, activeLearners: 0, coursesCompleted: 0, avgCompletionRate: 0 },
      coursePerformance: []
    })
  }

  const [{ data: courses }, { data: enrollments }] = await Promise.all([
    db.from('courses').select('id, title').in('id', courseIds),
    db.from('enrollments').select('course_id, user_id, completed_at, progress_percentage').in('course_id', courseIds)
  ])
  const enrollmentsList = enrollments ?? []
  const totalLearners = new Set(enrollmentsList.map((e: { user_id: string }) => e.user_id)).size
  const completedEnrollments = enrollmentsList.filter((e: { completed_at: string | null }) => e.completed_at).length
  const avgCompletionRate = enrollmentsList.length > 0
    ? Math.round(enrollmentsList.reduce((s: number, e: { progress_percentage?: number }) => s + (e.progress_percentage ?? 0), 0) / enrollmentsList.length)
    : 0

  const byCourse: Record<string, { enrolled: number; completed: number; inProgress: number; totalProgress: number }> = {}
  courseIds.forEach((id: string) => { byCourse[id] = { enrolled: 0, completed: 0, inProgress: 0, totalProgress: 0 } })
  enrollmentsList.forEach((e: { course_id: string; completed_at: string | null; progress_percentage?: number }) => {
    if (!byCourse[e.course_id]) byCourse[e.course_id] = { enrolled: 0, completed: 0, inProgress: 0, totalProgress: 0 }
    byCourse[e.course_id].enrolled++
    byCourse[e.course_id].totalProgress += e.progress_percentage ?? 0
    if (e.completed_at) byCourse[e.course_id].completed++
    else byCourse[e.course_id].inProgress++
  })

  const coursePerformance = (courses ?? []).map((c: { id: string; title: string }) => {
    const bc = byCourse[c.id] ?? { enrolled: 0, completed: 0, inProgress: 0, totalProgress: 0 }
    const completionRate = bc.enrolled ? Math.round(bc.totalProgress / bc.enrolled) : 0
    return {
      id: c.id,
      name: c.title,
      enrolled: bc.enrolled,
      completed: bc.completed,
      inProgress: bc.inProgress,
      completionRate,
      avgScore: 0,
      avgTime: '—',
      dropOffRate: 0,
      satisfaction: 0,
      trend: 'up',
      trendValue: 0
    }
  })

  return NextResponse.json({
    overview: {
      totalLearners,
      activeLearners: totalLearners,
      coursesCompleted: completedEnrollments,
      avgCompletionRate
    },
    coursePerformance
  })
}
