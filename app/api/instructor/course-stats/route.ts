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
  if (courseIds.length === 0) return NextResponse.json({ stats: {}, extras: {}, totalUniqueLearners: 0 })

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

  const extras: Record<string, { avgRating: number; totalRatings: number; hasQuiz: boolean; views: number }> = {}
  courseIds.forEach((id: string) => { extras[id] = { avgRating: 0, totalRatings: 0, hasQuiz: false, views: 0 } })

  const [{ data: ratings }, { data: modules }, { data: lessons }, { data: viewEvents }] = await Promise.all([
    db.from('course_ratings').select('course_id, rating').in('course_id', courseIds),
    db.from('modules').select('id, course_id').in('course_id', courseIds),
    courseIds.length
      ? db.from('modules').select('id, course_id').in('course_id', courseIds).then(async ({ data: mods }) => {
          const modIds = (mods ?? []).map((m: { id: string }) => m.id)
          if (!modIds.length) return { data: [] as { id: string; module_id: string }[] }
          return db.from('lessons').select('id, module_id').in('module_id', modIds)
        })
      : Promise.resolve({ data: [] as { id: string; module_id: string }[] }),
    db.from("course_analytics").select("course_id").in("course_id", courseIds).eq("event_type", "view"),
  ])

  ;(ratings ?? []).forEach((r: { course_id: string; rating: number }) => {
    const e = extras[r.course_id]
    if (!e) return
    e.totalRatings += 1
    e.avgRating += r.rating ?? 0
  })
  Object.keys(extras).forEach((id) => {
    const e = extras[id]
    e.avgRating = e.totalRatings ? Math.round((e.avgRating / e.totalRatings) * 10) / 10 : 0
  })

  ;(viewEvents ?? []).forEach((v: { course_id: string }) => {
    if (extras[v.course_id]) extras[v.course_id].views++
  })

  const lessonIds = (lessons ?? []).map((l: { id: string }) => l.id)
  if (lessonIds.length) {
    const { data: quizItems } = await db
      .from('content_items')
      .select('lesson_id, content_type')
      .in('lesson_id', lessonIds)
      .eq('content_type', 'quiz')
    const modToCourse: Record<string, string> = {}
    ;(modules ?? []).forEach((m: { id: string; course_id: string }) => { modToCourse[m.id] = m.course_id })
    const lessonToCourse: Record<string, string> = {}
    ;(lessons ?? []).forEach((l: { id: string; module_id: string }) => {
      lessonToCourse[l.id] = modToCourse[l.module_id] ?? ''
    })
    ;(quizItems ?? []).forEach((item: { lesson_id: string }) => {
      const cid = lessonToCourse[item.lesson_id]
      if (cid && extras[cid]) extras[cid].hasQuiz = true
    })
  }

  return NextResponse.json(
    { stats, extras, totalUniqueLearners: uniqueUserIds.size },
    { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=30" } }
  )
}
