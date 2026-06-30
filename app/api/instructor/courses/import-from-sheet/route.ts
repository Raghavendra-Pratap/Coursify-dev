import { createServerClient } from '@supabase/ssr';
import { createServerClient as createServiceClient } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { parseCourseSheet } from '@/lib/parseCourseSheet';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  try {
    const cookieStore = request.cookies;
    const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const db = createServiceClient();

    const formData = await request.formData();
    const file = formData.get('sheet') as File | null;
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file. Use form field "sheet" with a CSV file.' }, { status: 400 });
    }
    const name = (file.name || '').toLowerCase();
    if (!name.endsWith('.csv')) {
      return NextResponse.json({ error: 'Only CSV files are supported.' }, { status: 400 });
    }

    const text = await file.text();
    const { data, errors } = parseCourseSheet(text);
    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 }
      );
    }
    if (!data || data.modules.length === 0) {
      return NextResponse.json(
        { error: 'No valid course structure. Add at least one module with one lesson and one content item.' },
        { status: 400 }
      );
    }

    const { data: courseRow, error: courseErr } = await db
      .from('courses')
      .insert({
        title: data.title,
        description: data.description || null,
        status: 'draft',
        created_by: user.id,
      })
      .select('id')
      .single();
    if (courseErr) {
      console.error('[import-from-sheet] course insert', courseErr);
      return NextResponse.json({ error: 'Failed to create course', details: courseErr.message }, { status: 500 });
    }
    const courseId = (courseRow as { id: string }).id;

    for (const mod of data.modules) {
      const { data: modRow, error: modErr } = await db
        .from('modules')
        .insert({
          course_id: courseId,
          title: mod.title,
          description: mod.description || null,
          order_index: mod.order,
        })
        .select('id')
        .single();
      if (modErr) {
        console.error('[import-from-sheet] module insert', modErr);
        return NextResponse.json({ error: 'Failed to create module', details: modErr.message }, { status: 500 });
      }
      const moduleId = (modRow as { id: string }).id;

      for (const les of mod.lessons) {
        const durationSec =
          les.durationSeconds ??
          les.content
            .filter((c) => c.videoSegments?.length || c.video)
            .reduce((s, c) => {
              const segs = c.videoSegments ?? (c.video ? [c.video] : []);
              return s + segs.reduce((a, vs) => a + (vs.durationSeconds ?? 0), 0);
            }, 0);
        const { data: lesRow, error: lesErr } = await db
          .from('lessons')
          .insert({
            module_id: moduleId,
            title: les.title,
            description: les.description || null,
            order_index: les.order,
            duration_seconds: durationSec ?? 0,
          })
          .select('id')
          .single();
        if (lesErr) {
          console.error('[import-from-sheet] lesson insert', lesErr);
          return NextResponse.json({ error: 'Failed to create lesson', details: lesErr.message }, { status: 500 });
        }
        const lessonId = (lesRow as { id: string }).id;

        for (const item of les.content) {
          const { data: itemRow, error: itemErr } = await db
            .from('content_items')
            .insert({
              lesson_id: lessonId,
              content_type: item.type,
              order_index: item.order,
            })
            .select('id')
            .single();
          if (itemErr) {
            console.error('[import-from-sheet] content_item insert', itemErr);
            return NextResponse.json({ error: 'Failed to create content item', details: itemErr.message }, { status: 500 });
          }
          const contentItemId = (itemRow as { id: string }).id;

          if (item.type === 'reading' && item.reading) {
            await db.from('reading_materials').insert({
              content_item_id: contentItemId,
              title: item.reading.title || 'Reading',
              type: item.reading.type,
              url: item.reading.type === 'url' ? (item.reading.url || null) : null,
              body: item.reading.type === 'native' ? (item.reading.body || null) : null,
            });
          }
          if (item.type === 'video') {
            const segments = item.videoSegments?.length ? item.videoSegments : (item.video ? [item.video] : []);
            for (let idx = 0; idx < segments.length; idx++) {
              const vs = segments[idx]!;
              const { error: segErr } = await db.from('video_segments').insert({
                content_item_id: contentItemId,
                name: vs.name || 'Video',
                duration_seconds: vs.durationSeconds || 60,
                start_time_seconds: vs.startSeconds ?? 0,
                end_time_seconds: vs.endSeconds ?? (vs.startSeconds ?? 0) + (vs.durationSeconds || 60),
                source: vs.source,
                source_url: vs.sourceUrl || null,
                storage_path: vs.sourceUrl || null,
              });
              if (segErr) {
                console.error('[import-from-sheet] video_segment insert', segErr);
                return NextResponse.json({ error: 'Failed to create video segment', details: segErr.message }, { status: 500 });
              }
            }
          }
          if (item.type === 'quiz' && item.quiz) {
            await db.from('quizzes').insert({
              content_item_id: contentItemId,
              title: item.quiz.title || 'Quiz',
              passing_score: 70,
              form_url: item.quiz.formUrl || null,
            });
          }
          if (item.type === 'form' && item.form) {
            await db.from('forms').insert({
              content_item_id: contentItemId,
              title: item.form.title || 'Form',
              form_url: item.form.formUrl || null,
            });
          }
        }
      }
    }

    return NextResponse.json({ courseId }, { status: 201 });
  } catch (e) {
    console.error('[import-from-sheet]', e);
    return NextResponse.json(
      { error: 'Import failed', details: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
