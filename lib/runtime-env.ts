/**
 * Read server env at runtime. Use dynamic `process.env[key]` so Next.js does not
 * inline undefined during `next build` when secrets are only set in Docker at runtime.
 */
export function runtimeEnv(key: string): string | undefined {
  const value = process.env[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function runtimeEnvPresent(key: string): boolean {
  return typeof process.env[key] === 'string';
}
