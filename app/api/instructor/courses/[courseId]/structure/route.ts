/**
 * POST: Replace full course structure (modules, lessons, content_items, video_segments).
 * Deletes all existing modules for the course (CASCADE removes lessons/content), then inserts
 * the payload. Ensures module/lesson counts stay in sync and prevents duplicate modules.
 */
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { createServerClient as createServiceClient } from '@/lib/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function parseTimeToSeconds(time: string): number {
  const parts = time.split(':').map(Number)
  if (parts.length >= 3) return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0)
  if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0)
  if (parts.length === 1) return parts[0] ?? 0
  return 0
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params
  if (!courseId) return NextResponse.json({ error: 'Course ID required' }, { status: 400 })

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
  const { data: course } = await db.from('courses').select('id, created_by').eq('id', courseId).single()
  if (!course || (course as { created_by: string }).created_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { title?: string; description?: string; modules: Array<{
    title: string; order: number; lessons: Array<{
      title: string; order: number; duration?: string; content: Array<{
        type: string; order: number; videoSegment?: { name?: string; source?: string; sourceUrl?: string; startTime?: string; endTime?: string; duration?: string; startTimestamp?: number; endTimestamp?: number }; reading?: { title?: string; type?: string; url?: string; body?: string }; quiz?: { title?: string; passingScore?: number }
      }>
    }>
  }> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!Array.isArray(body.modules)) return NextResponse.json({ error: 'modules array required' }, { status: 400 })

  if (body.title != null) {
    await db.from('courses').update({ title: body.title, description: body.description ?? null, updated_at: new Date().toISOString() }).eq('id', courseId)
  }

  const { error: delErr } = await db.from('modules').delete().eq('course_id', courseId)
  if (delErr) return NextResponse.json({ error: 'Failed to clear old modules', details: delErr.message }, { status: 500 })

  for (let mi = 0; mi < body.modules.length; mi++) {
    const mod = body.modules[mi]
    const { data: modRow, error: modErr } = await db.from('modules').insert({
      course_id: courseId,
      title: mod.title ?? `Module ${mi + 1}`,
      order_index: mod.order ?? mi,
    }).select('id').single()
    if (modErr) return NextResponse.json({ error: 'Failed to insert module', details: modErr.message }, { status: 500 })
    const moduleId = (modRow as { id: string } | null)?.id
    if (!moduleId) continue

    for (let li = 0; li < (mod.lessons ?? []).length; li++) {
      const les = mod.lessons[li]
      const durationSec = les.duration ? parseTimeToSeconds(les.duration) : (les.content ?? [])
        .filter((c: { type?: string; videoSegment?: unknown }) => c.type === 'video' && c.videoSegment)
        .reduce((acc: number, c: { videoSegment?: { duration?: string } }) => acc + parseTimeToSeconds(c.videoSegment?.duration ?? '0'), 0)
      const { data: lesRow, error: lesErr } = await db.from('lessons').insert({
        module_id: moduleId,
        title: les.title ?? `Lesson ${li + 1}`,
        order_index: les.order ?? li,
        duration_seconds: durationSec,
      }).select('id').single()
      if (lesErr) return NextResponse.json({ error: 'Failed to insert lesson', details: lesErr.message }, { status: 500 })
      const lessonId = (lesRow as { id: string } | null)?.id
      if (!lessonId) continue

      for (let ci = 0; ci < (les.content ?? []).length; ci++) {
        const item = les.content[ci]
        const { data: itemRow, error: itemErr } = await db.from('content_items').insert({
          lesson_id: lessonId,
          content_type: item.type ?? 'video',
          order_index: item.order ?? ci,
        }).select('id').single()
        if (itemErr) return NextResponse.json({ error: 'Failed to insert content item', details: itemErr.message }, { status: 500 })
        const contentItemId = (itemRow as { id: string } | null)?.id
        if (!contentItemId) continue

        if (item.type === 'reading' && item.reading) {
          await db.from('reading_materials').insert({
            content_item_id: contentItemId,
            title: item.reading.title ?? 'Reading',
            type: item.reading.type ?? 'native',
            url: item.reading.type === 'url' ? (item.reading.url ?? null) : null,
            body: item.reading.type === 'native' ? (item.reading.body ?? null) : null,
          })
        }
        if (item.type === 'video' && item.videoSegment) {
          const vs = item.videoSegment
          const startSec = vs.startTimestamp ?? (vs.startTime ? parseTimeToSeconds(vs.startTime) : 0)
          const endSec = vs.endTimestamp ?? (vs.endTime ? parseTimeToSeconds(vs.endTime) : (vs.duration ? parseTimeToSeconds(vs.duration) : 0))
          const videoUrl = vs.sourceUrl ?? ''
          const storageType = vs.source === 'google_drive' ? 'google_drive' : (vs.source === 'youtube' || vs.source === 'external_url' ? 'external_url' : 'supabase')
          await db.from('video_segments').insert({
            lesson_id: lessonId,
            segment_index: item.order ?? ci,
            video_url: videoUrl,
            start_time: startSec,
            end_time: endSec,
            storage_type: storageType,
            storage_path: videoUrl || null,
            content_item_id: contentItemId,
            name: vs.name ?? 'Video',
            duration_seconds: Math.max(0, endSec - startSec),
            start_time_seconds: startSec,
            end_time_seconds: endSec,
            source: vs.source ?? 'upload',
            source_url: vs.sourceUrl ?? null,
          })
        }
        if (item.type === 'quiz' && item.quiz) {
          await db.from('quizzes').insert({
            content_item_id: contentItemId,
            title: item.quiz.title ?? 'Quiz',
            passing_score: item.quiz.passingScore ?? 70,
          })
        }
      }
    }
  }

  return NextResponse.json({ ok: true })
}
