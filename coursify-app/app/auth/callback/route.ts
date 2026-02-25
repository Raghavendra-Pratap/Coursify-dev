import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const supabase = createClient()

  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
  }

  // TODO: Handle error cases (e.g., invalid code, expired token)
  return NextResponse.redirect(new URL('/dashboard', requestUrl.origin))
}
