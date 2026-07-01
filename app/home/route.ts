import { NextResponse } from 'next/server';
import { getLandingHtml } from '@/lib/landing-html';

export const dynamic = 'force-static';

export function GET() {
  const html = getLandingHtml();
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
}
