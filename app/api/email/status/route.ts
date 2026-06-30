import { NextResponse } from 'next/server';
import { getFromEmail, getResendApiKey, isResendConfigured } from '@/lib/resend-email';

/** GET: whether outbound email (Resend) is configured on this deployment. */
export async function GET() {
  const key = getResendApiKey();
  const configured = isResendConfigured();
  return NextResponse.json({
    configured,
    // Safe diagnostics when configured is false (no secret leaked).
    keyPresent: typeof process.env.RESEND_API_KEY === 'string',
    keyLength: key?.length ?? 0,
    keyLooksValid: Boolean(key?.startsWith('re_')),
    fromEmail: configured ? getFromEmail() : null,
  });
}
