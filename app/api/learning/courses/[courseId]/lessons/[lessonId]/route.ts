import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { createServerClient as createServiceClient } from '@/lib/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseId: string; lessonId: string }> }
) {
  const { courseId, lessonId } = await params
  if (!courseId || !lessonId) {
    return NextResponse.json({ error: 'Course ID and Lesson ID required' }, { status: 400 })
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

  const { data: lesson, error: lessonError } = await db
    .from('lessons')
    .select('id, module_id, title, description, order_index')
    .eq('id', lessonId)
    .single()

  if (lessonError || !lesson) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
  }

  const { data: contentItems } = await db
    .from('content_items')
    .select('id, content_type, order_index')
    .eq('lesson_id', lessonId)
    .order('order_index')

  const items = (contentItems ?? []).map((ci) => ({ ...ci, videoSegments: [] as unknown[], readingMaterial: null as unknown, quiz: null as unknown }))
  const contentItemIds = items.map((c) => c.id).filter(Boolean)

  if (contentItemIds.length > 0) {
    const [segmentsRes, readingRes, quizzesRes] = await Promise.all([
      db.from('video_segments').select('id, content_item_id, name, duration_seconds, start_time_seconds, end_time_seconds, source, source_url, storage_path').in('content_item_id', contentItemIds).order('id'),
      db.from('reading_materials').select('*').in('content_item_id', contentItemIds),
      db.from('quizzes').select('*').in('content_item_id', contentItemIds),
    ])

    const byContentId: Record<string, { segments: unknown[]; reading: unknown; quiz: unknown }> = {}
    for (const id of contentItemIds) byContentId[id] = { segments: [], reading: null, quiz: null }

    for (const s of segmentsRes.data ?? []) {
      const cid = (s as { content_item_id: string }).content_item_id
      if (byContentId[cid]) byContentId[cid].segments.push(s)
    }
    for (const r of readingRes.data ?? []) {
      const cid = (r as { content_item_id: string }).content_item_id
      if (byContentId[cid]) byContentId[cid].reading = r
    }
    for (const q of quizzesRes.data ?? []) {
      const cid = (q as { content_item_id: string }).content_item_id
      if (byContentId[cid]) byContentId[cid].quiz = q
    }

    for (const it of items) {
      const extra = byContentId[it.id]
      if (extra) {
        it.videoSegments = extra.segments
        it.readingMaterial = extra.reading
        it.quiz = extra.quiz
      }
    }
  }

  return NextResponse.json({
    lesson: { id: lesson.id, module_id: lesson.module_id, title: lesson.title, description: lesson.description, order_index: lesson.order_index },
    contentItems: items,
  })
}
