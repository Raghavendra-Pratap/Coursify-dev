import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { ROUTES, viewForLandingIntent } from '@/lib/site-urls'

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value, cookie)
  })
}

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

  const { data: { session } } = await supabase.auth.getSession()

  const { pathname } = request.nextUrl
  if (pathname === '/') {
    const url = request.nextUrl.clone()
    const params = url.searchParams
    const hasAppQuery =
      params.has('enroll') ||
      params.has('landing') ||
      params.has('view') ||
      params.has('code') ||
      params.has('error')

    if (hasAppQuery) {
      url.pathname = ROUTES.login
    } else if (session?.user) {
      url.pathname = ROUTES.login
      url.search = ''
    } else {
      url.pathname = ROUTES.home
      url.search = ''
    }

    const redirectResponse = NextResponse.redirect(url)
    copyCookies(response, redirectResponse)
    return redirectResponse
  }

  if (pathname === ROUTES.login && session?.user) {
    const url = request.nextUrl.clone()
    const params = url.searchParams
    if (!params.has('code') && !params.has('error')) {
      const landing = params.get('landing')
      const targetView = viewForLandingIntent(landing ?? (params.get('view') === 'courses' ? 'learner' : 'instructor'))
      if (params.get('view') !== targetView) {
        params.set('view', targetView)
        const redirectResponse = NextResponse.redirect(url)
        copyCookies(response, redirectResponse)
        return redirectResponse
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
