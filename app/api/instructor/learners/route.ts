import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { createServerClient as createServiceClient } from '@/lib/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/** GET: user IDs of all learners enrolled in courses owned or collaborated by current user. */
export async function GET(request: Request) {
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
  const { data: owned } = await db.from('courses').select('id').eq('created_by', user.id)
  const { data: collab } = await db.from('course_collaborators').select('course_id').eq('user_id', user.id)
  const ownedIds = (owned ?? []).map((c: { id: string }) => c.id)
  const collabIds = (collab ?? []).map((c: { course_id: string }) => c.course_id)
  const courseIds = Array.from(new Set([...ownedIds, ...collabIds]))
  if (courseIds.length === 0) return NextResponse.json({ userIds: [] })

  const { data: enrollments } = await db.from('enrollments').select('user_id').in('course_id', courseIds)
  const userIds = Array.from(new Set((enrollments ?? []).map((e: { user_id: string }) => e.user_id)))
  return NextResponse.json({ userIds })
}
