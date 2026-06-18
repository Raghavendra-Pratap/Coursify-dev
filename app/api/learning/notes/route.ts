import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { createServerClient as createServiceClient } from '@/lib/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function getUser(request: Request) {
  if (!supabaseUrl || !supabaseAnonKey) return null
  const cookieHeader = request.headers.get('cookie') ?? ''
  const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        const m = cookieHeader.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
        return m ? decodeURIComponent(m[1]) : undefined
      },
      set() {},
      remove() {},
    },
  })
  const { data: { user } } = await supabaseAuth.auth.getUser()
  return user
}

/** GET: list all notes for user, or single note via ?courseId=&lessonId= */
export async function GET(request: Request) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server config missing' }, { status: 500 })
  }
  const db = createServiceClient()
  const url = new URL(request.url)
  const courseId = url.searchParams.get('courseId')
  const lessonId = url.searchParams.get('lessonId')

  if (courseId && lessonId) {
    const { data, error } = await db
      .from('learner_notes')
      .select('*')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .eq('lesson_id', lessonId)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ note: data ?? null })
  }

  const { data, error } = await db
    .from('learner_notes')
    .select('course_id, lesson_id, course_title, lesson_title, module_id, module_title, content, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ notes: data ?? [] })
}

/** PUT: upsert a note for course + lesson */
export async function PUT(request: Request) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server config missing' }, { status: 500 })
  }
  const body = await request.json().catch(() => ({}))
  const courseId = typeof body.courseId === 'string' ? body.courseId : ''
  const lessonId = typeof body.lessonId === 'string' ? body.lessonId : ''
  const content = typeof body.content === 'string' ? body.content : ''
  const courseTitle = typeof body.courseTitle === 'string' ? body.courseTitle : ''
  const lessonTitle = typeof body.lessonTitle === 'string' ? body.lessonTitle : ''
  const moduleId = typeof body.moduleId === 'string' ? body.moduleId : null
  const moduleTitle = typeof body.moduleTitle === 'string' ? body.moduleTitle : null

  if (!courseId || !lessonId) {
    return NextResponse.json({ error: 'courseId and lessonId required' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from('learner_notes')
    .upsert(
      {
        user_id: user.id,
        course_id: courseId,
        lesson_id: lessonId,
        course_title: courseTitle,
        lesson_title: lessonTitle,
        module_id: moduleId,
        module_title: moduleTitle,
        content,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,course_id,lesson_id' }
    )
    .select('course_id, lesson_id, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, note: data })
}
