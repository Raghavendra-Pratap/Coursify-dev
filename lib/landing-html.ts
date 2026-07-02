import { readFileSync } from 'fs';
import { join } from 'path';
import { loginPath, ROUTES } from '@/lib/site-urls';

const LANDING_FILE = join(process.cwd(), 'public/landing/coursify-landing.html');

const LANDING_FAVICON_TAGS = `
  <link rel="icon" href="/favicon.ico" sizes="any"/>
  <link rel="icon" href="/brand/coursify-mark.svg" type="image/svg+xml"/>
  <link rel="icon" href="/brand/favicon-32.png" sizes="32x32" type="image/png"/>
  <link rel="apple-touch-icon" href="/apple-icon.png"/>`;

/** Source design file: coursify - logo and design/coursify-landing.html */
export function getLandingHtml(): string {
  let html = readFileSync(LANDING_FILE, 'utf8');

  const home = ROUTES.home;
  const login = loginPath();
  const earlyAccess = loginPath({ landing: 'instructor' });

  if (!html.includes('rel="icon"')) {
    html = html.replace(
      '<title>Coursify — Micro-video LMS</title>',
      `<title>Coursify — Micro-video LMS</title>${LANDING_FAVICON_TAGS}`,
    );
  }

  html = html
    .replace('href="#" class="nav-logo"', `href="${home}" class="nav-logo"`)
    .replace('href="#" class="btn-nav-ghost"', `href="${login}" class="btn-nav-ghost"`)
    .replace('href="#" class="btn-nav-cta"', `href="${earlyAccess}" class="btn-nav-cta"`)
    .replaceAll('href="#" class="btn-primary"', `href="${earlyAccess}" class="btn-primary"`);

  return html;
}
