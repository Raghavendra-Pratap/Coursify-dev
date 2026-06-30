/** True when URL is AP easy-mode embed (not portal /assessment/{token} setup). */
export function isAssessmentEmbedUrl(url: string): boolean {
  try {
    const { pathname } = new URL(url);
    return pathname.includes('/embed/assessment/') || pathname.startsWith('/embed/');
  } catch {
    return false;
  }
}
