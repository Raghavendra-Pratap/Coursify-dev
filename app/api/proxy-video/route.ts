import { NextRequest, NextResponse } from 'next/server'

function isValidVideoUrl(u: string): boolean {
  try {
    const parsed = new URL(u)
    if (!['http:', 'https:'].includes(parsed.protocol)) return false
    const host = parsed.hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') || host.endsWith('.local')) return false
    return true
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  if (!url || !isValidVideoUrl(url)) {
    return NextResponse.json({ error: 'Invalid or disallowed URL' }, { status: 400 })
  }
  try {
    const range = request.headers.get('range') || ''
    const res = await fetch(url, {
      headers: range ? { Range: range } : {},
      redirect: 'follow',
    })
    if (!res.ok) {
      return new NextResponse(null, { status: res.status })
    }
    const contentType = res.headers.get('content-type') || 'video/mp4'
    const contentLength = res.headers.get('content-length')
    const acceptRanges = res.headers.get('accept-ranges') || 'bytes'
    const headers = new Headers()
    headers.set('Content-Type', contentType)
    headers.set('Accept-Ranges', acceptRanges)
    if (contentLength) headers.set('Content-Length', contentLength)
    const resRange = res.headers.get('content-range')
    if (resRange) headers.set('Content-Range', resRange)
    return new NextResponse(res.body, { status: res.status, headers })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch video' }, { status: 502 })
  }
}
