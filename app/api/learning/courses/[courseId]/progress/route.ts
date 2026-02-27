import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { createServerClient as createServiceClient } from '@/lib/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function getAuthFromRequest(request: Request) {
  const cookieHeader = request.headers.get('cookie') ?? ''
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
        return match ? decodeURIComponent(match[1]) : undefined
      },
      set() {},
      remove() {},
    },
  })
}

/** Recalculate enrollment progress from progress table and update enrollment. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params
    if (!courseId) return NextResponse.json({ error: 'Course ID required' }, { status: 400 })
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Server config missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local' }, { status: 500 })
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is required. Add it to .env.local and restart the dev server.' }, { status: 500 })
    }
    const supabaseAuth = getAuthFromRequest(request)
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const db = createServiceClient()
    const { data: enrollment, error: enrollError } = await db
      .from('enrollments')
      .select('id')
      .eq('course_id', courseId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (enrollError || !enrollment) return NextResponse.json({ error: 'Not enrolled' }, { status: 403 })
    const { data: courseModules } = await db.from('modules').select('id').eq('course_id', courseId)
    const moduleIds = (courseModules ?? []).map((m: { id: string }) => m.id)
    const { data: lessonRows } = moduleIds.length > 0
      ? await db.from('lessons').select('id').in('module_id', moduleIds)
      : { data: [] }
    const total = Array.isArray(lessonRows) ? lessonRows.length : 0
    const { data: progressRows } = await db.from('progress').select('id').eq('enrollment_id', enrollment.id).eq('completed', true)
    const completed = Array.isArray(progressRows) ? progressRows.length : 0
    const progressPercentage = total > 0 ? Math.round((completed / total) * 100) : 0
    const now = new Date().toISOString()
    const enrollmentUpdate: { progress_percentage: number; completed_at?: string } = { progress_percentage: progressPercentage }
    if (progressPercentage >= 100) enrollmentUpdate.completed_at = now
    const { error: updateError } = await db.from('enrollments').update(enrollmentUpdate).eq('id', enrollment.id)
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
    return NextResponse.json({ progress_percentage: progressPercentage })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Progress recalc failed'
    console.error('[progress GET]', message, err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params
  if (!courseId) {
    return NextResponse.json({ error: 'Course ID required' }, { status: 400 })
  }

  const supabaseAuth = getAuthFromRequest(request)
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { lessonId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const lessonId = body.lessonId
  if (!lessonId || typeof lessonId !== 'string') {
    return NextResponse.json({ error: 'lessonId required' }, { status: 400 })
  }

  const db = createServiceClient()

  const { data: enrollment, error: enrollError } = await db
    .from('enrollments')
    .select('id')
    .eq('course_id', courseId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (enrollError || !enrollment) {
    return NextResponse.json({ error: 'Not enrolled in this course' }, { status: 403 })
  }

  const { error: upsertError } = await db
    .from('progress')
    .upsert(
      {
        enrollment_id: enrollment.id,
        lesson_id: lessonId,
        completed: true,
        completed_at: new Date().toISOString(),
        last_accessed_at: new Date().toISOString(),
      },
      { onConflict: 'enrollment_id,lesson_id' }
    )

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  const { data: courseModules } = await db.from('modules').select('id').eq('course_id', courseId)
  const moduleIds = (courseModules ?? []).map((m: { id: string }) => m.id)
  const { data: lessonRows } = moduleIds.length > 0
    ? await db.from('lessons').select('id').in('module_id', moduleIds)
    : { data: [] }
  const total = Array.isArray(lessonRows) ? lessonRows.length : 0
  const { data: progressRows } = await db
    .from('progress')
    .select('id')
    .eq('enrollment_id', enrollment.id)
    .eq('completed', true)
  const completed = Array.isArray(progressRows) ? progressRows.length : 0
  const progressPercentage = total > 0 ? Math.round((completed / total) * 100) : 0
  const now = new Date().toISOString()
  const enrollmentUpdate: { progress_percentage: number; completed_at?: string } = { progress_percentage: progressPercentage }
  if (progressPercentage >= 100) enrollmentUpdate.completed_at = now
  const { error: updateError } = await db.from('enrollments').update(enrollmentUpdate).eq('id', enrollment.id)
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
