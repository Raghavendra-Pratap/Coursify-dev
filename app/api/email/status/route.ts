import { NextResponse } from 'next/server';
import { getFromEmail, getResendApiKey, isResendConfigured } from '@/lib/resend-email';
import { runtimeEnvDiagnostics } from '@/lib/runtime-env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** GET: whether outbound email (Resend) is configured on this deployment. */
export async function GET() {
  const key = getResendApiKey();
  const configured = isResendConfigured();
  const diag = runtimeEnvDiagnostics('RESEND_API_KEY');
  return NextResponse.json({
    configured,
    keyPresent: diag.keyPresent,
    keyLength: diag.keyLength,
    keyLooksValid: Boolean(key?.startsWith('re_')),
    fileEnvLoaded: diag.fileEnvLoaded,
    fileEnvPath: diag.fileEnvPath,
    fromEmail: configured ? getFromEmail() : null,
  });
}
