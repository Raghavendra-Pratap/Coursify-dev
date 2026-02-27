import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient as createServiceClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Not configured', enrolled: 0 }, { status: 503 })
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value
      },
      set() {},
      remove() {},
    },
  })

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.email) {
    return NextResponse.json({ enrolled: 0 }, { status: 200 })
  }

  const userId = session.user.id
  const email = session.user.email.toLowerCase()

  let admin: ReturnType<typeof createServiceClient>
  try {
    admin = createServiceClient()
  } catch {
    return NextResponse.json({ error: 'Server config', enrolled: 0 }, { status: 503 })
  }

  const { data: invites } = await admin
    .from('learner_invites')
    .select('id, course_id')
    .eq('email', email)
    .eq('status', 'pending')
    .not('course_id', 'is', null)

  if (!invites?.length) {
    return NextResponse.json({ enrolled: 0 }, { status: 200 })
  }

  const courseIds = Array.from(new Set(invites.map((i: { course_id: string }) => i.course_id)))
  const { data: existing } = await admin
    .from('enrollments')
    .select('course_id')
    .eq('user_id', userId)
    .in('course_id', courseIds)
  const alreadyEnrolled = new Set((existing ?? []).map((e: { course_id: string }) => e.course_id))

  let enrolled = 0
  for (const inv of invites as { id: string; course_id: string }[]) {
    if (alreadyEnrolled.has(inv.course_id)) {
      await admin.from('learner_invites').update({ status: 'accepted' }).eq('id', inv.id)
      continue
    }
    const { error: insertErr } = await admin.from('enrollments').insert({
      course_id: inv.course_id,
      user_id: userId,
    })
    if (!insertErr) {
      enrolled++
      await admin.from('learner_invites').update({ status: 'accepted' }).eq('id', inv.id)
    }
  }

  return NextResponse.json({ enrolled }, { status: 200 })
}
