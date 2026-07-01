import { readFileSync } from 'fs';
import { join } from 'path';
import { loginPath, ROUTES } from '@/lib/site-urls';

const LANDING_FILE = join(process.cwd(), 'public/landing/coursify-landing.html');

/** Source design file: coursify - logo and design/coursify-landing.html */
export function getLandingHtml(): string {
  let html = readFileSync(LANDING_FILE, 'utf8');

  const home = ROUTES.home;
  const login = loginPath();
  const earlyAccess = loginPath({ landing: 'instructor' });

  html = html
    .replace('href="#" class="nav-logo"', `href="${home}" class="nav-logo"`)
    .replace('href="#" class="btn-nav-ghost"', `href="${login}" class="btn-nav-ghost"`)
    .replace('href="#" class="btn-nav-cta"', `href="${earlyAccess}" class="btn-nav-cta"`)
    .replaceAll('href="#" class="btn-primary"', `href="${earlyAccess}" class="btn-primary"`);

  return html;
}
