/** Open a URL in a new tab (typed for strict builds where Window.open is missing). */
export function openExternalUrl(url: string, target = '_blank', features = 'noopener,noreferrer'): void {
  if (typeof globalThis === 'undefined') return;
  const opener = (globalThis as unknown as { open?: (u: string, t?: string, f?: string) => Window | null }).open;
  opener?.(url, target, features);
}
