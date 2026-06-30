/**
 * POST: Replace full course structure (modules, lessons, content_items, video_segments).
 * Deletes all existing modules for the course (CASCADE removes lessons/content), then inserts
 * the payload. Ensures module/lesson counts stay in sync and prevents duplicate modules.
 */
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { createServerClient as createServiceClient } from '@/lib/supabase-admin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function parseTimeToSeconds(time: string): number {
  const parts = time.split(':').map(Number)
  if (parts.length >= 3) return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0)
  if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0)
  if (parts.length === 1) return parts[0] ?? 0
  return 0
}

export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
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

  let db;
  try {
    db = createServiceClient();
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Admin database client unavailable';
    return NextResponse.json(
      { error: 'Server misconfiguration', details: `${message}. Set SUPABASE_SERVICE_ROLE_KEY in .env.local and restart the dev server.` },
      { status: 500 }
    );
  }

  const { data: course } = await db.from('courses').select('id, created_by').eq('id', courseId).single()
  if (!course || (course as { created_by: string }).created_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { title?: string; description?: string; modules: Array<{
    title: string; order: number; lessons: Array<{
      title: string; order: number; duration?: string; content: Array<{
        type: string; order: number; videoSegment?: { name?: string; source?: string; sourceUrl?: string; startTime?: string; endTime?: string; duration?: string; startTimestamp?: number; endTimestamp?: number }; reading?: { title?: string; type?: string; url?: string; body?: string; format?: string }; quiz?: { title?: string; passingScore?: number; formUrl?: string; formEntryIdWebhook?: string }; form?: { title?: string; formUrl?: string }; assessment?: { title?: string; description?: string; assessmentProId?: string; accessMode?: string; passingScore?: number }
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
  const { data: courseMeta } = await db.from('courses').select('status').eq('id', courseId).maybeSingle()
  if ((courseMeta as { status?: string } | null)?.status === 'published') {
    const { error: flagErr } = await db
      .from('courses')
      .update({ has_unpublished_changes: true, updated_at: new Date().toISOString() })
      .eq('id', courseId)
    // Column may be missing if DRAFT_PUBLISHED_SNAPSHOT.sql was not run — save must still succeed.
    if (flagErr && !/has_unpublished_changes/i.test(flagErr.message ?? '')) {
      return NextResponse.json({ error: 'Failed to update course flags', details: flagErr.message }, { status: 500 })
    }
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
        description: (les as { description?: string | null }).description ?? null,
        order_index: les.order ?? li,
        duration_seconds: durationSec,
      }).select('id').single()
      if (lesErr) return NextResponse.json({ error: 'Failed to insert lesson', details: lesErr.message }, { status: 500 })
      const lessonId = (lesRow as { id: string } | null)?.id
      if (!lessonId || typeof lessonId !== 'string') continue

      // Ensure the lesson is visible before inserting content_items to avoid FK violation
      const { data: lessonCheck, error: checkErr } = await db.from('lessons').select('id').eq('id', lessonId).single()
      if (checkErr || !lessonCheck) {
        return NextResponse.json({
          error: 'Lesson not found after insert',
          details: checkErr?.message ?? 'Lesson row missing; possible transaction or RLS issue.',
        }, { status: 500 })
      }

      for (let ci = 0; ci < (les.content ?? []).length; ci++) {
        const item = les.content[ci]
        const { data: itemRow, error: itemErr } = await db.from('content_items').insert({
          lesson_id: lessonId,
          content_type: item.type ?? 'video',
          order_index: item.order ?? ci,
        }).select('id').single()
        if (itemErr) {
          return NextResponse.json({
            error: 'Failed to insert content item',
            details: itemErr.message,
            context: `module ${mi + 1}, lesson ${li + 1}, content ${ci + 1}`,
          }, { status: 500 })
        }
        const contentItemId = (itemRow as { id: string } | null)?.id
        if (!contentItemId) continue

        if (item.type === 'reading' && item.reading) {
          await db.from('reading_materials').insert({
            content_item_id: contentItemId,
            title: item.reading.title ?? 'Reading',
            type: item.reading.type ?? 'native',
            url: item.reading.type === 'url' ? (item.reading.url ?? null) : null,
            body: item.reading.type === 'native' ? (item.reading.body ?? null) : null,
            format: item.reading.type === 'native' ? (item.reading.format ?? 'plain') : null,
          })
        }
        if (item.type === 'video' && item.videoSegment) {
          const vs = item.videoSegment
          const startSec = vs.startTimestamp ?? (vs.startTime ? parseTimeToSeconds(vs.startTime) : 0)
          const endSec =
            vs.endTimestamp ??
            (vs.endTime ? parseTimeToSeconds(vs.endTime) : startSec + (vs.duration ? parseTimeToSeconds(vs.duration) : 0))
          const sourceUrl = vs.sourceUrl ?? null
          const { error: segErr } = await db.from('video_segments').insert({
            content_item_id: contentItemId,
            name: vs.name ?? 'Video',
            duration_seconds: Math.max(1, endSec - startSec),
            start_time_seconds: startSec,
            end_time_seconds: endSec,
            source: vs.source ?? 'upload',
            source_url: sourceUrl,
            storage_path: sourceUrl,
          })
          if (segErr) {
            return NextResponse.json({
              error: 'Failed to insert video segment',
              details: segErr.message,
              context: `module ${mi + 1}, lesson ${li + 1}, content ${ci + 1}`,
            }, { status: 500 })
          }
        }
        if (item.type === 'quiz' && item.quiz) {
          await db.from('quizzes').insert({
            content_item_id: contentItemId,
            title: item.quiz.title ?? 'Quiz',
            passing_score: item.quiz.passingScore ?? 70,
            form_url: item.quiz.formUrl ?? null,
            form_entry_id_webhook: item.quiz.formEntryIdWebhook?.trim() ?? null,
          })
        }
        if (item.type === 'assessment' && item.assessment) {
          const assessmentProId = item.assessment.assessmentProId?.trim() ?? ''
          if (!/^[0-9a-f-]{36}$/i.test(assessmentProId)) {
            return NextResponse.json({
              error: 'Invalid Assessment Pro ID on assessment content',
              details: 'assessmentProId must be a UUID. Save the assessment from the designer or pick an existing one.',
              context: `module ${mi + 1}, lesson ${li + 1}, content ${ci + 1}`,
            }, { status: 400 })
          }
          const accessMode = item.assessment.accessMode === 'proctored_portal' ? 'proctored_portal' : 'lms_embed'
          const presentation = accessMode === 'proctored_portal' ? 'new_tab' : 'embed'
          const { error: extErr } = await db.from('external_assessments').insert({
            content_item_id: contentItemId,
            assessment_pro_assessment_id: assessmentProId,
            access_mode: accessMode,
            presentation,
            passing_score: item.assessment.passingScore ?? 70,
            title: item.assessment.title ?? 'Assessment',
            description: item.assessment.description ?? null,
          })
          if (extErr) {
            const hint = /content_type|external_assessments|does not exist/i.test(extErr.message ?? '')
              ? ' Run database/ADD_EXTERNAL_ASSESSMENTS.sql in Supabase SQL Editor.'
              : ''
            return NextResponse.json({
              error: 'Failed to save assessment content',
              details: (extErr.message ?? 'insert failed') + hint,
              context: `module ${mi + 1}, lesson ${li + 1}, content ${ci + 1}`,
            }, { status: 500 })
          }
        }

        if (item.type === 'form' && item.form) {
          await db.from('forms').insert({
            content_item_id: contentItemId,
            title: item.form.title ?? 'Form',
            form_url: item.form.formUrl ?? null,
          })
        }
      }
    }
  }

  return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Structure save failed';
    console.error('[structure]', message);
    return NextResponse.json({ error: 'Failed to save course structure', details: message }, { status: 500 });
  }
}
