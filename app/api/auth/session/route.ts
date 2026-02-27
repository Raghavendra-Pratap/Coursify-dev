import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const DEBUG_AUTH = process.env.NODE_ENV === 'development'

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ session: null }, { status: 200 })
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

  if (DEBUG_AUTH) {
    const names = request.cookies.getAll().map((c) => c.name).filter((n) => n.includes('supabase') || n.includes('sb-') || n.includes('auth'))
    console.warn('[api/auth/session] cookie names (auth-related):', names.length ? names : 'none')
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (DEBUG_AUTH) console.warn('[api/auth/session] getSession:', session ? 'user_id=' + session.user?.id : 'null')
  return NextResponse.json({ session })
}
