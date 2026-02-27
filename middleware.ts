import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return response

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        response.cookies.set({ name, value, ...options, path: '/', sameSite: 'lax' })
      },
      remove(name: string, options: Record<string, unknown>) {
        response.cookies.set({ name, value: '', maxAge: 0, ...options, path: '/', sameSite: 'lax' })
      },
    },
  })

  // Refresh session so cookies stay in sync and session persists on refresh
  await supabase.auth.getSession()

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
