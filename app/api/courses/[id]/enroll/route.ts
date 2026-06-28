import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient as createServiceClient } from '@/lib/supabase-admin';
import { getNotificationPreferencesMap } from '@/lib/notification-preferences'

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

  // Notify creator/collaborators when someone enrolls.
  try {
    const { data: c } = await admin.from('courses').select('title, created_by').eq('id', courseId).maybeSingle()
    const courseTitle = (c as { title?: string | null } | null)?.title || 'Course'
    const creatorId = (c as { created_by?: string } | null)?.created_by
    const { data: collabs } = await admin.from('course_collaborators').select('user_id').eq('course_id', courseId)
    const recipients = Array.from(new Set([creatorId, ...((collabs ?? []).map((r: { user_id: string }) => r.user_id))].filter(Boolean))) as string[]
    const notifyIds = recipients.filter((id) => id !== userId)
    if (notifyIds.length > 0) {
      const prefs = await getNotificationPreferencesMap(notifyIds)
      const targetIds = notifyIds.filter((id) => (prefs.get(id)?.notify_enrollments ?? true))
      if (targetIds.length > 0) {
        await admin.from('user_notifications').insert(
          targetIds.map((uid) => ({
            user_id: uid,
            type: 'new_enrollment',
            title: 'New enrollment',
            body: `A learner enrolled in ${courseTitle}.`,
            link: '/',
            related_id: courseId,
          }))
        )
      }
    }
  } catch {
    // Keep enrollment success even if notification insert fails.
  }

  return NextResponse.json({ enrolled: true }, { status: 200 })
}
