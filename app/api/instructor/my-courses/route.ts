import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { createServerClient as createServiceClient } from '@/lib/supabase';
import { getInstructorCourseIds } from '@/lib/instructor-course-access';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0 || !Number.isFinite(totalSeconds)) return '0m';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export async function GET(request: Request) {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
        return match ? decodeURIComponent(match[1]) : undefined;
      },
      set() {},
      remove() {},
    },
  });
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createServiceClient();
  const { courseIds } = await getInstructorCourseIds(db, user.id);

  if (courseIds.length === 0) {
    return NextResponse.json(
      { courses: [], totalUniqueLearners: 0, contentMix: {} },
      { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=60' } }
    );
  }

  const [{ data: courseList }, { data: enrollments }, { data: modules }, { data: ratings }, { data: viewEvents }] =
    await Promise.all([
      db.from('courses').select('id, title, description, status, created_at, updated_at, created_by, has_unpublished_changes').in('id', courseIds).order('updated_at', { ascending: false }),
      db.from('enrollments').select('course_id, user_id, progress_percentage').in('course_id', courseIds),
      db.from('modules').select('id, course_id').in('course_id', courseIds),
      db.from('course_ratings').select('course_id, rating').in('course_id', courseIds),
      db.from('course_analytics').select('course_id').in('course_id', courseIds).eq('event_type', 'view'),
    ]);

  const moduleIds = (modules ?? []).map((m: { id: string }) => m.id);
  const { data: lessons } = moduleIds.length
    ? await db.from('lessons').select('id, module_id, duration_seconds').in('module_id', moduleIds)
    : { data: [] };

  const lessonIds = (lessons ?? []).map((l: { id: string }) => l.id);
  const [{ data: contentItems }, { data: quizItems }] = lessonIds.length
    ? await Promise.all([
        db.from('content_items').select('content_type, lesson_id').in('lesson_id', lessonIds),
        db.from('content_items').select('lesson_id').in('lesson_id', lessonIds).eq('content_type', 'quiz'),
      ])
    : [{ data: [] }, { data: [] }];

  const modToCourse: Record<string, string> = {};
  (modules ?? []).forEach((m: { id: string; course_id: string }) => { modToCourse[m.id] = m.course_id; });

  const modulesByCourse: Record<string, number> = {};
  const lessonsByCourse: Record<string, number> = {};
  const durationSecondsByCourse: Record<string, number> = {};
  (modules ?? []).forEach((m: { course_id: string }) => { modulesByCourse[m.course_id] = (modulesByCourse[m.course_id] ?? 0) + 1; });
  (lessons ?? []).forEach((l: { module_id: string; duration_seconds?: number | null }) => {
    const cid = modToCourse[l.module_id];
    if (!cid) return;
    lessonsByCourse[cid] = (lessonsByCourse[cid] ?? 0) + 1;
    durationSecondsByCourse[cid] = (durationSecondsByCourse[cid] ?? 0) + (Number(l.duration_seconds) || 0);
  });

  const stats: Record<string, { learners: number; avgCompletion: number }> = {};
  courseIds.forEach((id) => { stats[id] = { learners: 0, avgCompletion: 0 }; });
  const uniqueUserIds = new Set<string>();
  (enrollments ?? []).forEach((e: { course_id: string; user_id: string; progress_percentage?: number }) => {
    uniqueUserIds.add(e.user_id);
    if (!stats[e.course_id]) stats[e.course_id] = { learners: 0, avgCompletion: 0 };
    stats[e.course_id].learners += 1;
    stats[e.course_id].avgCompletion += e.progress_percentage ?? 0;
  });
  Object.keys(stats).forEach((id) => {
    const n = stats[id].learners;
    stats[id].avgCompletion = n ? Math.round(stats[id].avgCompletion / n) : 0;
  });

  const extras: Record<string, { avgRating: number; totalRatings: number; hasQuiz: boolean; views: number }> = {};
  courseIds.forEach((id) => { extras[id] = { avgRating: 0, totalRatings: 0, hasQuiz: false, views: 0 }; });
  (ratings ?? []).forEach((r: { course_id: string; rating: number }) => {
    const e = extras[r.course_id];
    if (!e) return;
    e.totalRatings += 1;
    e.avgRating += r.rating ?? 0;
  });
  Object.keys(extras).forEach((id) => {
    const e = extras[id];
    e.avgRating = e.totalRatings ? Math.round((e.avgRating / e.totalRatings) * 10) / 10 : 0;
  });
  (viewEvents ?? []).forEach((v: { course_id: string }) => { if (extras[v.course_id]) extras[v.course_id].views++; });

  const lessonToCourse: Record<string, string> = {};
  (lessons ?? []).forEach((l: { id: string; module_id: string }) => { lessonToCourse[l.id] = modToCourse[l.module_id] ?? ''; });
  (quizItems ?? []).forEach((item: { lesson_id: string }) => {
    const cid = lessonToCourse[item.lesson_id];
    if (cid && extras[cid]) extras[cid].hasQuiz = true;
  });

  const contentMix: Record<string, { video: number; reading: number; quiz: number }> = {};
  (contentItems ?? []).forEach((i: { content_type: string; lesson_id: string }) => {
    const courseId = lessonToCourse[i.lesson_id];
    if (!courseId) return;
    if (!contentMix[courseId]) contentMix[courseId] = { video: 0, reading: 0, quiz: 0 };
    if (i.content_type === 'video') contentMix[courseId].video++;
    else if (i.content_type === 'quiz' || i.content_type === 'form' || i.content_type === 'assessment') contentMix[courseId].quiz++;
    else contentMix[courseId].reading++;
  });

  const courses = (courseList ?? []).map((c: {
    id: string; title: string; description: string | null; status: string;
    created_at: string; updated_at: string; created_by?: string; has_unpublished_changes?: boolean;
  }) => {
    const st = stats[c.id] ?? { learners: 0, avgCompletion: 0 };
    const ex = extras[c.id] ?? { avgRating: 0, totalRatings: 0, hasQuiz: false, views: 0 };
    return {
      id: c.id, title: c.title, description: c.description || '', thumbnail: 'blue',
      modules: modulesByCourse[c.id] ?? 0, lessons: lessonsByCourse[c.id] ?? 0,
      learners: st.learners, enrolled: st.learners, completion: st.avgCompletion,
      avgRating: ex.avgRating, totalRatings: ex.totalRatings, status: c.status,
      duration: formatDuration(durationSecondsByCourse[c.id] ?? 0),
      lastUpdated: c.updated_at, createdDate: c.created_at, views: ex.views,
      trend: st.avgCompletion >= 50 ? 'up' : 'down', trendValue: st.avgCompletion,
      hasQuiz: ex.hasQuiz, hasCertificate: c.status === 'published',
      category: 'General', language: 'English', level: 'Beginner', tags: [] as string[],
      createdBy: c.created_by, hasUnpublishedChanges: !!c.has_unpublished_changes,
    };
  });

  return NextResponse.json(
    { courses, totalUniqueLearners: uniqueUserIds.size, contentMix },
    { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=60' } }
  );
}
