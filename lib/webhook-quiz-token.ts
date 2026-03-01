/**
 * Signed tokens for Google Form quiz webhook. Prevents forgery and replay.
 * Only the server can create valid tokens; webhook verifies signature and one-time use.
 */

import crypto from 'crypto';

const ALG = 'sha256';
const SEP = '.';
const TTL_SEC = 2 * 60 * 60; // 2 hours

function getSecret(): string {
  const s = process.env.WEBHOOK_QUIZ_SECRET;
  if (!s || s.length < 32) {
    throw new Error('WEBHOOK_QUIZ_SECRET must be set and at least 32 characters');
  }
  return s;
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Buffer {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  return Buffer.from(b64 + (pad ? '='.repeat(4 - pad) : ''), 'base64');
}

export interface QuizTokenPayload {
  enrollment_id: string;
  content_item_id: string;
  exp: number;
}

/** Create a signed token (only call from authenticated learning API). */
export function signQuizToken(enrollmentId: string, contentItemId: string): string {
  const secret = getSecret();
  const exp = Math.floor(Date.now() / 1000) + TTL_SEC;
  const payload: QuizTokenPayload = {
    enrollment_id: enrollmentId,
    content_item_id: contentItemId,
    exp,
  };
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = base64UrlEncode(Buffer.from(payloadJson, 'utf8'));
  const sig = crypto.createHmac(ALG, secret).update(payloadB64).digest();
  const sigB64 = base64UrlEncode(sig);
  return payloadB64 + SEP + sigB64;
}

/** Verify token and decode payload. Returns null if invalid or expired. */
export function verifyQuizToken(token: string): QuizTokenPayload | null {
  try {
    const secret = getSecret();
    const i = token.lastIndexOf(SEP);
    if (i <= 0) return null;
    const payloadB64 = token.slice(0, i);
    const sigB64 = token.slice(i + 1);
    const sig = crypto.createHmac(ALG, secret).update(payloadB64).digest();
    const expectedSigB64 = base64UrlEncode(sig);
    if (sigB64 !== expectedSigB64) return null;
    const payloadJson = base64UrlDecode(payloadB64).toString('utf8');
    const payload = JSON.parse(payloadJson) as QuizTokenPayload;
    if (typeof payload.exp !== 'number' || payload.exp < Date.now() / 1000) return null;
    if (typeof payload.enrollment_id !== 'string' || typeof payload.content_item_id !== 'string') return null;
    if (!/^[0-9a-f-]{36}$/i.test(payload.enrollment_id) || !/^[0-9a-f-]{36}$/i.test(payload.content_item_id)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** SHA-256 hash of token for one-time-use table. */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}
