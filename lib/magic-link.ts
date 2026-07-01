/**
 * Signed course magic links: share /go/TOKEN instead of /course/UUID to hide course IDs.
 * Token = base64url(payload).base64url(hmac). Valid for 1 year by default.
 */

import { createHmac } from 'crypto'
import { runtimeEnv } from '@/lib/runtime-env'

const ALG = 'sha256'
const DEFAULT_EXPIRY_MS = 365 * 24 * 60 * 60 * 1000

type MagicPayload = { courseId?: string; programId?: string; exp: number }

export type VerifiedMagicLink =
  | { type: 'course'; id: string }
  | { type: 'program'; id: string }

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4)
  return Buffer.from(padded, 'base64')
}

function getSecret(): string {
  const secret = runtimeEnv('MAGIC_LINK_SECRET')
  if (!secret || secret.length < 16) {
    throw new Error('MAGIC_LINK_SECRET must be set (min 16 chars) for course magic links')
  }
  return secret
}

function signPayload(payload: MagicPayload): string {
  const secret = getSecret()
  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload), 'utf8'))
  const hmac = createHmac(ALG, secret).update(payloadB64).digest()
  const sigB64 = base64UrlEncode(hmac)
  return `${payloadB64}.${sigB64}`
}

export function createCourseMagicToken(courseId: string, expiryMs: number = DEFAULT_EXPIRY_MS): string {
  return signPayload({ courseId, exp: Date.now() + expiryMs })
}

export function createProgramMagicToken(programId: string, expiryMs: number = DEFAULT_EXPIRY_MS): string {
  return signPayload({ programId, exp: Date.now() + expiryMs })
}

export function verifyMagicToken(token: string): VerifiedMagicLink | null {
  try {
    const secret = getSecret()
    const [payloadB64, sigB64] = token.split('.')
    if (!payloadB64 || !sigB64) return null
    const expectedHmac = createHmac(ALG, secret).update(payloadB64).digest()
    const expectedSig = base64UrlEncode(expectedHmac)
    if (expectedSig !== sigB64) return null
    const payloadJson = base64UrlDecode(payloadB64).toString('utf8')
    const payload = JSON.parse(payloadJson) as MagicPayload
    if (!payload || typeof payload.exp !== 'number') return null
    if (Date.now() > payload.exp) return null
    if (payload.courseId) return { type: 'course', id: payload.courseId }
    if (payload.programId) return { type: 'program', id: payload.programId }
    return null
  } catch {
    return null
  }
}

export function verifyCourseMagicToken(token: string): string | null {
  const verified = verifyMagicToken(token)
  return verified?.type === 'course' ? verified.id : null
}

export function buildMagicGoUrl(
  type: 'course' | 'program',
  id: string,
  baseUrl?: string,
): string {
  const base = (baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
  try {
    const token = type === 'course' ? createCourseMagicToken(id) : createProgramMagicToken(id)
    return `${base}/go/${token}`
  } catch {
    return type === 'course' ? `${base}/course/${encodeURIComponent(id)}` : `${base}/program/${encodeURIComponent(id)}`
  }
}
