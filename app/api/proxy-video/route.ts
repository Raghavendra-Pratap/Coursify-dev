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

/** Use usercontent endpoint with confirm=t so Google returns the file instead of virus-scan HTML. */
function resolveDriveUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.hostname.toLowerCase() === 'drive.google.com' && parsed.pathname === '/uc') {
      const id = parsed.searchParams.get('id')
      if (id) return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`
    }
  } catch {
    // ignore
  }
  return url
}

function isDriveUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return host === 'drive.google.com' || host === 'drive.usercontent.google.com'
  } catch {
    return false
  }
}

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export async function GET(request: NextRequest) {
  let url = request.nextUrl.searchParams.get('url')
  if (!url || !isValidVideoUrl(url)) {
    return NextResponse.json({ error: 'Invalid or disallowed URL' }, { status: 400 })
  }
  url = resolveDriveUrl(url)
  try {
    const range = request.headers.get('range') || ''
    const isDrive = isDriveUrl(url)
    const res = await fetch(url, {
      headers: {
        ...(range ? { Range: range } : {}),
        'User-Agent': BROWSER_UA,
        ...(isDrive ? { Accept: '*/*', Referer: 'https://drive.google.com/' } : {}),
      },
      redirect: 'follow',
    })
    if (!res.ok) {
      return new NextResponse(null, { status: res.status })
    }
    const rawContentType = res.headers.get('content-type') || ''
    const contentType = rawContentType.split(';')[0].trim().toLowerCase()
    if (contentType === 'text/html') {
      await res.body?.cancel()
      return NextResponse.json({ error: 'Drive returned HTML instead of video. Ensure the file is shared as "Anyone with the link can view".' }, { status: 502 })
    }
    const contentLength = res.headers.get('content-length')
    const acceptRanges = res.headers.get('accept-ranges') || 'bytes'
    const headers = new Headers()
    headers.set('Content-Type', rawContentType || 'video/mp4')

    headers.set('Accept-Ranges', acceptRanges)
    if (contentLength) headers.set('Content-Length', contentLength)
    const resRange = res.headers.get('content-range')
    if (resRange) headers.set('Content-Range', resRange)
    return new NextResponse(res.body, { status: res.status, headers })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch video' }, { status: 502 })
  }
}
