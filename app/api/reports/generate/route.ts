import { NextResponse } from 'next/server'
import { createServerClient as createServiceClient } from '@/lib/supabase-admin';

/** Cron/worker endpoint: generate enrollment CSV snapshot. Requires Authorization: Bearer CRON_SECRET */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!cronSecret || token !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server config missing' }, { status: 500 })
  }

  const db = createServiceClient()
  const [{ data: enrollments }, { data: courses }, { data: profiles }] = await Promise.all([
    db.from('enrollments').select('id, user_id, course_id, progress_percentage, completed_at, enrolled_at'),
    db.from('courses').select('id, title'),
    db.from('user_profiles').select('id, full_name'),
  ])

  const courseMap = new Map((courses ?? []).map((c: { id: string; title: string }) => [c.id, c.title]))
  const profileMap = new Map((profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? '']))
  const rows = (enrollments ?? []).map((e: { course_id: string; user_id: string; progress_percentage?: number; completed_at?: string | null; enrolled_at?: string }) => ({
    course: courseMap.get(e.course_id) ?? e.course_id,
    learner: profileMap.get(e.user_id) ?? e.user_id,
    progress: e.progress_percentage ?? 0,
    completed: e.completed_at ? 'Yes' : 'No',
    enrolled_at: e.enrolled_at ?? '',
  }))

  const headers = ['Course', 'Learner', 'Progress %', 'Completed', 'Enrolled At']
  const csv = [headers.join(',')].concat(
    rows.map((r) => [r.course, r.learner, r.progress, r.completed, r.enrolled_at].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
  ).join('\n')

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="enrollment-report-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
