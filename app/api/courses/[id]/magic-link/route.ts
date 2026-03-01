import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient as createServiceClient } from '@/lib/supabase'
import { createCourseMagicToken } from '@/lib/magic-link'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const courseId = params?.id
  if (!courseId) return NextResponse.json({ error: 'Course ID required' }, { status: 400 })

  if (!supabaseUrl || !supabaseAnonKey) return NextResponse.json({ error: 'Server config missing' }, { status: 500 })

  const cookieHeader = request.headers.get('cookie') ?? ''
  const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        const m = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
        return m ? decodeURIComponent(m[1]) : undefined
      },
      set() {},
      remove() {},
    },
  })
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const db = createServiceClient()
    const { data: profile } = await db.from('user_profiles').select('role').eq('id', user.id).maybeSingle()
    const isAdmin = (profile as { role?: string } | null)?.role === 'admin'

    if (!isAdmin) {
      const { data: course } = await db.from('courses').select('id, created_by').eq('id', courseId).maybeSingle()
      if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })
      const ownerId = (course as { created_by?: string }).created_by
      if (ownerId !== user.id) {
        const { data: collab } = await db.from('course_collaborators').select('course_id').eq('course_id', courseId).eq('user_id', user.id).maybeSingle()
        if (!collab) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const token = createCourseMagicToken(courseId)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
    const magicLink = `${baseUrl}/go/${token}`

    return NextResponse.json({ magicLink, token })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create magic link'
    if (message.includes('MAGIC_LINK_SECRET')) return NextResponse.json({ error: message }, { status: 503 })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
