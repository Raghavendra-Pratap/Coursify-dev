import { NextResponse } from 'next/server';
import { isResendConfigured } from '@/lib/resend-email';

/** GET: whether outbound email (Resend) is configured on this deployment. */
export async function GET() {
  return NextResponse.json({
    configured: isResendConfigured(),
    fromEmail: isResendConfigured()
      ? process.env.RESEND_FROM_EMAIL || 'Coursify <onboarding@resend.dev>'
      : null,
  });
}
