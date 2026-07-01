/**
 * Learner vs instructor landing rules:
 * - Invite / magic-link / course enrollment → learner
 * - Contributor (co-instructor) link → instructor
 * - Returning users → last chosen mode (localStorage, then auth user_metadata)
 * - Fresh signup with no prior choice → null (show mode picker)
 */

import { supabase } from '@/lib/supabase';

export const SESSION_MODE_KEY = 'coursify_session_mode';
const LANDING_INTENT_KEY = 'coursify_landing_intent';

export type SessionMode = 'learner' | 'instructor';

export function isSessionMode(value: unknown): value is SessionMode {
  return value === 'learner' || value === 'instructor';
}

export function readStoredSessionMode(): SessionMode | null {
  if (typeof window === 'undefined') return null;
  const saved = localStorage.getItem(SESSION_MODE_KEY);
  return isSessionMode(saved) ? saved : null;
}

export function readPreferredSessionModeFromUser(user: {
  user_metadata?: Record<string, unknown>;
}): SessionMode | null {
  const value = user.user_metadata?.preferred_session_mode;
  return isSessionMode(value) ? value : null;
}

export function stashLandingIntent(mode: SessionMode): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(LANDING_INTENT_KEY, mode);
  } catch {
    // ignore quota errors
  }
}

export function consumeLandingIntent(): SessionMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = sessionStorage.getItem(LANDING_INTENT_KEY);
    sessionStorage.removeItem(LANDING_INTENT_KEY);
    return isSessionMode(value) ? value : null;
  } catch {
    return null;
  }
}

/** Infer landing mode from the current URL (pathname + search). */
export function detectLandingIntentFromLocation(
  pathname: string,
  search: string,
): SessionMode | null {
  const params = new URLSearchParams(search);

  const explicit = params.get('landing');
  if (isSessionMode(explicit)) return explicit;

  if (params.get('enroll')) return 'learner';

  const view = params.get('view');
  const courseId = params.get('course');
  if (view === 'create' && courseId) return 'instructor';

  if (pathname.startsWith('/course/') || pathname.startsWith('/go/') || pathname.startsWith('/program/')) {
    return 'learner';
  }

  return null;
}

export async function persistSessionMode(mode: SessionMode, userId?: string | null): Promise<void> {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SESSION_MODE_KEY, mode);
  }
  if (!userId) return;
  try {
    await supabase.auth.updateUser({ data: { preferred_session_mode: mode } });
  } catch {
    // best-effort cross-device recall
  }
}

export function defaultViewForMode(mode: SessionMode): 'dashboard' | 'courses' {
  return mode === 'instructor' ? 'dashboard' : 'courses';
}

export type ResolveSessionModeResult = {
  mode: SessionMode | null;
  source: 'landing' | 'local' | 'profile' | 'none';
};

/** Resolve session mode for a signed-in user (sync + optional profile metadata). */
export async function resolveSessionModeForUser(user: {
  id: string;
  user_metadata?: Record<string, unknown>;
}): Promise<ResolveSessionModeResult> {
  if (typeof window !== 'undefined') {
    const fromStash = consumeLandingIntent();
    const fromUrl = detectLandingIntentFromLocation(window.location.pathname, window.location.search);
    const landing = fromStash ?? fromUrl;
    if (landing) {
      await persistSessionMode(landing, user.id);
      return { mode: landing, source: 'landing' };
    }
  }

  const local = readStoredSessionMode();
  if (local) return { mode: local, source: 'local' };

  const profile = readPreferredSessionModeFromUser(user);
  if (profile) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SESSION_MODE_KEY, profile);
    }
    return { mode: profile, source: 'profile' };
  }

  return { mode: null, source: 'none' };
}
