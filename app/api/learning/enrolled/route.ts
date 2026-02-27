import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient as createServiceClient } from '@/lib/supabase'

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
      .from('enrollments')
      .select('id, course_id, progress_percentage, completed_at')
      .eq('user_id', session.user.id)
    if (!enrollments?.length) {
      return NextResponse.json({ courses: [] }, { status: 200 })
    }
    const now = new Date().toISOString()
    for (const e of enrollments) {
      const courseId = (e as { course_id: string }).course_id
      const { data: courseModules } = await admin.from('modules').select('id').eq('course_id', courseId)
      const moduleIds = (courseModules ?? []).map((m: { id: string }) => m.id)
      const { data: lessonRows } = moduleIds.length > 0
        ? await admin.from('lessons').select('id').in('module_id', moduleIds)
        : { data: [] }
      const total = Array.isArray(lessonRows) ? lessonRows.length : 0
      const { data: progressRows } = await admin.from('progress').select('id').eq('enrollment_id', e.id).eq('completed', true)
      const completed = Array.isArray(progressRows) ? progressRows.length : 0
      const progressPercentage = total > 0 ? Math.round((completed / total) * 100) : 0
      const enrollmentUpdate: { progress_percentage: number; completed_at?: string } = { progress_percentage: progressPercentage }
      if (progressPercentage >= 100) enrollmentUpdate.completed_at = now
      await admin.from('enrollments').update(enrollmentUpdate).eq('id', e.id)
    }
    const courseIds = Array.from(new Set(enrollments.map((e: { course_id: string }) => e.course_id)))
    const { data: courseRows } = await admin.from('courses').select('id, title').in('id', courseIds)
    const courseMap = new Map((courseRows ?? []).map((c: { id: string; title: string }) => [c.id, c.title]))
    const { data: updatedEnrollments } = await admin
      .from('enrollments')
      .select('id, course_id, progress_percentage, completed_at')
      .eq('user_id', session.user.id)
    const list = updatedEnrollments ?? enrollments
    const courses = list.map((e: { id: string; course_id: string; progress_percentage: number; completed_at: string | null }) => ({
      id: e.id,
      course_id: e.course_id,
      title: courseMap.get(e.course_id) ?? 'Course',
      progress_percentage: e.progress_percentage ?? 0,
      completed_at: e.completed_at,
    }))
    return NextResponse.json({ courses }, { status: 200 })
  } catch {
    return NextResponse.json({ courses: [] }, { status: 200 })
  }
}
