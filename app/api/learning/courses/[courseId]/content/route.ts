import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { createServerClient as createServiceClient } from '@/lib/supabase-admin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params
  if (!courseId) {
    return NextResponse.json({ error: 'Course ID required' }, { status: 400 })
  }

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
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceClient()

  const { data: enrollment } = await db
    .from('enrollments')
    .select('id')
    .eq('course_id', courseId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!enrollment) {
    return NextResponse.json({ error: 'Not enrolled in this course' }, { status: 403 })
  }

  const { data: progressRows } = await db
    .from('progress')
    .select('lesson_id')
    .eq('enrollment_id', enrollment.id)
    .eq('completed', true)
  const completedLessonIds = (progressRows ?? []).map((p: { lesson_id: string }) => p.lesson_id).filter(Boolean)

  const { data: course, error: courseError } = await db
    .from('courses')
    .select('id, title, description, status')
    .eq('id', courseId)
    .single()

  if (courseError || !course || course.status !== 'published') {
    return NextResponse.json({ error: 'Course not found or not published' }, { status: 404 })
  }

  const { data: modules } = await db
    .from('modules')
    .select('id, title, order_index')
    .eq('course_id', courseId)
    .order('order_index')

  const moduleIds = (modules ?? []).map((m) => m.id).filter(Boolean)
  if (moduleIds.length === 0) {
    return NextResponse.json({
      course: { id: course.id, title: course.title, description: course.description },
      modules: [],
      completedLessonIds,
    })
  }

  const { data: lessons } = await db
    .from('lessons')
    .select('id, module_id, title, description, order_index')
    .in('module_id', moduleIds)
    .order('order_index')

  const lessonsByModule: Record<string, typeof lessons> = {}
  for (const id of moduleIds) lessonsByModule[id] = []
  for (const l of lessons ?? []) {
    const arr = l.module_id ? lessonsByModule[l.module_id] : undefined
    if (arr) arr.push(l)
  }
  const modulesWithLessons = (modules ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    order_index: m.order_index,
    lessons: (lessonsByModule[m.id] ?? []).map((l) => ({
      id: l.id,
      title: l.title,
      description: l.description,
      order_index: l.order_index,
    })),
  }))

  return NextResponse.json({
    course: { id: course.id, title: course.title, description: course.description },
    modules: modulesWithLessons,
    completedLessonIds,
  })
}
