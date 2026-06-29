import type { NextRequest } from 'next/server'

/** Public site origin behind Caddy/reverse proxy (Docker sets HOSTNAME=0.0.0.0 for bind). */
export function getPublicOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto')
  if (forwardedHost) {
    const host = forwardedHost.split(',')[0]?.trim()
    const proto = forwardedProto?.split(',')[0]?.trim() || 'https'
    if (host) return `${proto}://${host}`
  }

  const host = request.headers.get('host')
  if (host && !host.startsWith('0.0.0.0') && !host.startsWith('127.0.0.1')) {
    const proto = forwardedProto?.split(',')[0]?.trim() || 'https'
    return `${proto}://${host}`
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  if (appUrl && !appUrl.includes('0.0.0.0') && !appUrl.includes('localhost')) {
    return appUrl
  }

  return new URL(request.url).origin
}
