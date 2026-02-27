import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient as createServiceClient } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const courseId = params?.id
  if (!courseId) return NextResponse.json({ error: 'Course ID required' }, { status: 400 })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
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
    return NextResponse.json({ error: 'Sign in to enroll' }, { status: 401 })
  }

  // Use service-role client to verify course (same as GET /api/courses/[id]) so RLS doesn't hide published courses
  let course: { id: string; status: string } | null = null
  try {
    const admin = createServiceClient()
    const { data } = await admin.from('courses').select('id, status').eq('id', courseId).maybeSingle()
    course = data
  } catch {
    const { data } = await supabase.from('courses').select('id, status').eq('id', courseId).maybeSingle()
    course = data
  }
  if (!course || course.status !== 'published') {
    return NextResponse.json({ error: 'Course not found or not published' }, { status: 404 })
  }

  const userId = session.user.id
  let admin: ReturnType<typeof createServiceClient>
  try {
    admin = createServiceClient()
  } catch {
    return NextResponse.json({ error: 'Server config' }, { status: 503 })
  }

  const { data: existing } = await admin
    .from('enrollments')
    .select('id')
    .eq('course_id', courseId)
    .eq('user_id', userId)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ enrolled: true }, { status: 200 })
  }

  const { error } = await admin.from('enrollments').insert({
    course_id: courseId,
    user_id: userId,
  })
  if (error) {
    return NextResponse.json({ error: error.message || 'Enrollment failed' }, { status: 500 })
  }
  return NextResponse.json({ enrolled: true }, { status: 200 })
}
