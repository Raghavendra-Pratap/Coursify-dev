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
      admin.from("courses").select("id, title").in("id", courseIds),
    ])

    const modules = modulesData ?? []
    const moduleIds = modules.map((m: { id: string }) => m.id)
    const progressRows = progressData ?? []

    const { data: lessonsData } = moduleIds.length > 0
      ? await admin.from("lessons").select("id, module_id").in("module_id", moduleIds)
      : { data: [] }
    const lessons = (lessonsData ?? []) as { id: string; module_id: string }[]

    const moduleToCourse = new Map(modules.map((m: { id: string; course_id: string }) => [m.id, m.course_id]))
    const lessonCountByCourse: Record<string, number> = {}
    courseIds.forEach((id: string) => { lessonCountByCourse[id] = 0 })
    lessons.forEach((l) => {
      const cid = moduleToCourse.get(l.module_id)
      if (cid) lessonCountByCourse[cid] = (lessonCountByCourse[cid] ?? 0) + 1
    })

    const completedByEnrollment: Record<string, number> = {}
    enrollmentIds.forEach((id: string) => { completedByEnrollment[id] = 0 })
    progressRows.forEach((p: { enrollment_id: string }) => {
      completedByEnrollment[p.enrollment_id] = (completedByEnrollment[p.enrollment_id] ?? 0) + 1
    })

    const now = new Date().toISOString()
    const courseMap = new Map((courseRows ?? []).map((c: { id: string; title: string }) => [c.id, c.title]))

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

      return {
        id: e.id,
        course_id: e.course_id,
        title: courseMap.get(e.course_id) ?? "Course",
        progress_percentage: progressPercentage,
        completed_at: completedAt,
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
