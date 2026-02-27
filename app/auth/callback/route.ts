import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const DEBUG_AUTH = process.env.NODE_ENV === 'development'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin
  const next = requestUrl.searchParams.get('next') ?? '/'

  const response = NextResponse.redirect(`${origin}${next}`)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return NextResponse.redirect(`${origin}/`)

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        if (DEBUG_AUTH) console.warn('[auth/callback] set cookie', name, 'path=', (options as { path?: string }).path ?? 'default')
        response.cookies.set({ name, value, ...options, path: '/', sameSite: 'lax' })
      },
      remove(name: string, options: Record<string, unknown>) {
        response.cookies.set({ name, value: '', maxAge: 0, ...options, path: '/', sameSite: 'lax' })
      },
    },
  })

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (DEBUG_AUTH) console.warn('[auth/callback] exchangeCodeForSession', error ? 'error: ' + error.message : 'ok', data?.session ? 'session.user_id=' + data.session.user?.id : 'no session')
    if (error) {
      console.error('Auth callback exchangeCodeForSession error:', error.message)
      return NextResponse.redirect(`${origin}/?error=auth_callback_failed`)
    }
  }

  return response
}
