import 'server-only';
import { readFileSync } from 'fs';

/**
 * Read server env at runtime in Docker/standalone.
 * Next.js may expose a trimmed `process.env` in the server process; on Linux we
 * fall back to /proc/self/environ where Docker-injected secrets remain available.
 */
let linuxEnviron: Record<string, string> | null = null;

function readLinuxEnviron(): Record<string, string> {
  if (linuxEnviron) return linuxEnviron;
  linuxEnviron = {};
  try {
    const raw = readFileSync('/proc/self/environ');
    for (const part of raw.toString('utf8').split('\0')) {
      if (!part) continue;
      const eq = part.indexOf('=');
      if (eq <= 0) continue;
      linuxEnviron[part.slice(0, eq)] = part.slice(eq + 1);
    }
  } catch {
    // not Linux or unreadable — keep empty fallback
  }
  return linuxEnviron;
}

function rawEnv(key: string): string | undefined {
  const fromProcess = process.env[key];
  if (typeof fromProcess === 'string' && fromProcess.length > 0) return fromProcess;
  if (process.platform === 'linux') {
    const fromProc = readLinuxEnviron()[key];
    if (typeof fromProc === 'string' && fromProc.length > 0) return fromProc;
  }
  return undefined;
}

export function runtimeEnv(key: string): string | undefined {
  const value = rawEnv(key);
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function runtimeEnvPresent(key: string): boolean {
  return rawEnv(key) !== undefined;
}
