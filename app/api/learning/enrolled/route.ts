import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { createServerClient as createServiceClient } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ courses: [] }, { status: 200 })
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value
      },
      set() {},
      remove() {},
    },
  })

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) {
    return NextResponse.json({ courses: [] }, { status: 200 })
  }

  try {
    const admin = createServiceClient()
    const { data: enrollments } = await admin
      .from("enrollments")
      .select("id, course_id, progress_percentage, completed_at")
      .eq("user_id", session.user.id)
    if (!enrollments?.length) {
      return NextResponse.json({ courses: [] }, { status: 200 })
    }

    const courseIds = Array.from(new Set(enrollments.map((e: { course_id: string }) => e.course_id)))
    const enrollmentIds = enrollments.map((e: { id: string }) => e.id)

    const [
      { data: modulesData },
      { data: progressData },
      { data: courseRows },
    ] = await Promise.all([
      admin.from("modules").select("id, course_id").in("course_id", courseIds),
      admin.from("progress").select("enrollment_id").in("enrollment_id", enrollmentIds).eq("completed", true),
      admin.from("courses").select("id, title, updated_at").in("id", courseIds),
    ])

    const modules = modulesData ?? []
    const moduleIds = modules.map((m: { id: string }) => m.id)
    const progressRows = progressData ?? []

    const { data: lessonsData } = moduleIds.length > 0
      ? await admin.from("lessons").select("id, module_id, duration_seconds").in("module_id", moduleIds)
      : { data: [] }
    const lessons = (lessonsData ?? []) as { id: string; module_id: string }[]

    const moduleToCourse = new Map(modules.map((m: { id: string; course_id: string }) => [m.id, m.course_id]))
    const moduleCountByCourse: Record<string, number> = {}
    courseIds.forEach((id: string) => { moduleCountByCourse[id] = 0 })
    modules.forEach((m: { course_id: string }) => {
      const cid = m.course_id
      if (cid) moduleCountByCourse[cid] = (moduleCountByCourse[cid] ?? 0) + 1
    })
    const lessonCountByCourse: Record<string, number> = {}
    courseIds.forEach((id: string) => { lessonCountByCourse[id] = 0 })
    const durationByCourse: Record<string, number> = {}
    courseIds.forEach((id: string) => { durationByCourse[id] = 0 })
    lessons.forEach((l: { module_id: string; duration_seconds?: number }) => {
      const cid = moduleToCourse.get(l.module_id)
      if (cid) {
        lessonCountByCourse[cid] = (lessonCountByCourse[cid] ?? 0) + 1
        durationByCourse[cid] = (durationByCourse[cid] ?? 0) + (Number(l.duration_seconds) || 0)
      }
    })

    const completedByEnrollment: Record<string, number> = {}
    enrollmentIds.forEach((id: string) => { completedByEnrollment[id] = 0 })
    progressRows.forEach((p: { enrollment_id: string }) => {
      completedByEnrollment[p.enrollment_id] = (completedByEnrollment[p.enrollment_id] ?? 0) + 1
    })

    const now = new Date().toISOString()
    const courseMap = new Map((courseRows ?? []).map((c: { id: string; title: string }) => [c.id, c.title]))
    const courseUpdatedMap = new Map((courseRows ?? []).map((c: { id: string; updated_at?: string }) => [c.id, c.updated_at ?? null]))
    let myRatingsByCourse = new Map<string, { rating: number; review: string | null }>()
    let avgByCourse: Record<string, { avg: number; count: number }> = {}
    courseIds.forEach((id: string) => { avgByCourse[id] = { avg: 0, count: 0 } })
    try {
      const { data: allRatings } = await admin.from("course_ratings").select("course_id, rating, review").in("course_id", courseIds).eq("user_id", session.user.id)
      myRatingsByCourse = new Map((allRatings ?? []).map((r: { course_id: string; rating: number; review?: string | null }) => [r.course_id, { rating: r.rating, review: r.review ?? null }]))
      const { data: aggRatings } = await admin.from("course_ratings").select("course_id, rating").in("course_id", courseIds)
      ;(aggRatings ?? []).forEach((r: { course_id: string; rating: number }) => {
        const cid = r.course_id
        if (!avgByCourse[cid]) return
        const cur = avgByCourse[cid]
        cur.count += 1
        cur.avg = (cur.avg * (cur.count - 1) + r.rating) / cur.count
      })
    } catch (_) { /* course_ratings table may not exist */ }

    const updatePromises: Promise<unknown>[] = []
    const courses = enrollments.map((e: { id: string; course_id: string; progress_percentage?: number; completed_at?: string | null }) => {
      const total = lessonCountByCourse[e.course_id] ?? 0
      const completed = completedByEnrollment[e.id] ?? 0
      const progressPercentage = total > 0 ? Math.round((completed / total) * 100) : 0
      const completedAt = progressPercentage >= 100 ? now : (e.completed_at ?? null)

      updatePromises.push(Promise.resolve(
        admin.from("enrollments").update({
          progress_percentage: progressPercentage,
          ...(progressPercentage >= 100 ? { completed_at: now } : {}),
        }).eq("id", e.id))
      )

      const agg = avgByCourse[e.course_id] ?? { avg: 0, count: 0 }
      const my = myRatingsByCourse.get(e.course_id)
      return {
        id: e.id,
        course_id: e.course_id,
        title: courseMap.get(e.course_id) ?? "Course",
        progress_percentage: progressPercentage,
        completed_at: completedAt,
        module_count: moduleCountByCourse[e.course_id] ?? 0,
        duration_seconds: durationByCourse[e.course_id] ?? 0,
        updated_at: courseUpdatedMap.get(e.course_id) ?? null,
        avg_rating: Math.round(agg.avg * 10) / 10,
        total_ratings: agg.count,
        my_rating: my?.rating ?? null,
        my_review: my?.review ?? null,
      }
    })
    await Promise.all(updatePromises)

    return NextResponse.json(
      { courses },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, max-age=10, stale-while-revalidate=30",
        },
      }
    )
  } catch {
    return NextResponse.json({ courses: [] }, { status: 200 })
  }
}
