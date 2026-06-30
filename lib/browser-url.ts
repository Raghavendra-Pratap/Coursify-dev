/** Replace the current URL without navigation (typed for strict builds where Window.history is missing). */
export function replaceBrowserUrl(url: string): void {
  if (typeof globalThis === 'undefined') return;
  const history = (globalThis as unknown as { history?: { replaceState: (data: unknown, unused: string, url?: string | null) => void } }).history;
  history?.replaceState({}, '', url);
}
