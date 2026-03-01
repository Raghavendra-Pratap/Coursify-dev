import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { createServerClient as createServiceClient } from '@/lib/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/** GET: enrollment stats for courses owned or collaborated by current user (service role). */
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
  if (courseIds.length === 0) return NextResponse.json({ stats: {}, totalUniqueLearners: 0 })

  const { data: enrollments } = await db
    .from('enrollments')
    .select('course_id, user_id, progress_percentage')
    .in('course_id', courseIds)

  const stats: Record<string, { learners: number; avgCompletion: number }> = {}
  courseIds.forEach((id: string) => { stats[id] = { learners: 0, avgCompletion: 0 } })
  const uniqueUserIds = new Set<string>()
  ;(enrollments ?? []).forEach((e: { course_id: string; user_id: string; progress_percentage?: number }) => {
    uniqueUserIds.add(e.user_id)
    if (!stats[e.course_id]) stats[e.course_id] = { learners: 0, avgCompletion: 0 }
    stats[e.course_id].learners += 1
    stats[e.course_id].avgCompletion += e.progress_percentage ?? 0
  })
  Object.keys(stats).forEach((id) => {
    const n = stats[id].learners
    stats[id].avgCompletion = n ? Math.round(stats[id].avgCompletion / n) : 0
  })

  return NextResponse.json(
    { stats, totalUniqueLearners: uniqueUserIds.size },
    { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=30" } }
  )
}
