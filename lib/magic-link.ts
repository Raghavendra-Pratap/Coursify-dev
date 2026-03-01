/**
 * Signed course magic links: share /go/TOKEN instead of /course/UUID to hide course IDs.
 * Token = base64url(payload).base64url(hmac). Valid for 1 year by default.
 */

import { createHmac } from 'crypto'

const ALG = 'sha256'
const DEFAULT_EXPIRY_MS = 365 * 24 * 60 * 60 * 1000

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4)
  return Buffer.from(padded, 'base64')
}

function getSecret(): string {
  const secret = process.env.MAGIC_LINK_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('MAGIC_LINK_SECRET must be set (min 16 chars) for course magic links')
  }
  return secret
}

export function createCourseMagicToken(courseId: string, expiryMs: number = DEFAULT_EXPIRY_MS): string {
  const secret = getSecret()
  const exp = Date.now() + expiryMs
  const payload = JSON.stringify({ courseId, exp })
  const payloadB64 = base64UrlEncode(Buffer.from(payload, 'utf8'))
  const hmac = createHmac(ALG, secret).update(payloadB64).digest()
  const sigB64 = base64UrlEncode(hmac)
  return `${payloadB64}.${sigB64}`
}

export function verifyCourseMagicToken(token: string): string | null {
  try {
    const secret = getSecret()
    const [payloadB64, sigB64] = token.split('.')
    if (!payloadB64 || !sigB64) return null
    const expectedHmac = createHmac(ALG, secret).update(payloadB64).digest()
    const expectedSig = base64UrlEncode(expectedHmac)
    if (expectedSig !== sigB64) return null
    const payloadJson = base64UrlDecode(payloadB64).toString('utf8')
    const { courseId, exp } = JSON.parse(payloadJson) as { courseId: string; exp: number }
    if (!courseId || typeof exp !== 'number') return null
    if (Date.now() > exp) return null
    return courseId
  } catch {
    return null
  }
}
