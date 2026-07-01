/**
 * Marketing site vs LMS app URLs.
 *
 * - NEXT_PUBLIC_SITE_URL — public marketing domain (e.g. https://coursify.bsoc.space)
 * - NEXT_PUBLIC_APP_URL — LMS app base (same host or https://app.coursify.bsoc.space)
 *
 * Course invites, magic links, and emails use APP_URL.
 * Logo / “home” links use SITE_URL + /home.
 */

export const ROUTES = {
  home: '/home',
  login: '/login',
} as const;

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

export function getSiteUrl(): string {
  if (typeof window !== 'undefined') {
    return stripTrailingSlash(process.env.NEXT_PUBLIC_SITE_URL || window.location.origin);
  }
  return stripTrailingSlash(
    process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000',
  );
}

export function getAppUrl(): string {
  if (typeof window !== 'undefined') {
    return stripTrailingSlash(process.env.NEXT_PUBLIC_APP_URL || window.location.origin);
  }
  return stripTrailingSlash(
    process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      'http://localhost:3000',
  );
}

/** Default instructor/learner shell view for a marketing ?landing= link. */
export function viewForLandingIntent(landing: string | null | undefined): 'dashboard' | 'courses' {
  return landing === 'learner' ? 'courses' : 'dashboard';
}

/** Path to the marketing landing page (same host or external site). */
export function homePath(): string {
  return ROUTES.home;
}

/** Path to sign-in + LMS shell. */
export function loginPath(query?: Record<string, string | undefined>): string {
  if (!query) return ROUTES.login;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value != null && value !== '') params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `${ROUTES.login}?${qs}` : ROUTES.login;
}

/** Absolute marketing home URL (for emails when site ≠ app host). */
export function absoluteHomeUrl(): string {
  return `${getSiteUrl()}${ROUTES.home}`;
}

/** Absolute LMS URL with optional path + query. */
export function absoluteAppUrl(path = ROUTES.login, query?: Record<string, string | undefined>): string {
  const base = getAppUrl();
  if (path === ROUTES.login && query) {
    return `${base}${loginPath(query)}`;
  }
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
}
