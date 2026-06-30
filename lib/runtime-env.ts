import { existsSync, readFileSync } from 'fs';

/** Entrypoint copies mount here with mode 644 (readable by nextjs). */
const RUNTIME_ENV_FILE = '/app/config/runtime.env';
/** Bind-mount from host (may be root-only; do not rely on app reading this directly). */
const DOCKER_ENV_FILE = '/app/config/production.env';

const SERVER_SECRET_KEYS = new Set([
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'RESEND_REPLY_TO',
  'SUPABASE_SERVICE_ROLE_KEY',
  'MAGIC_LINK_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'YOUTUBE_API_KEY',
]);

let fileEnviron: Record<string, string> | null = null;
let linuxEnviron: Record<string, string> | null = null;

function parseDotenv(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim().replace(/\r$/, '');
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function readFileEnviron(): Record<string, string> {
  if (fileEnviron) return fileEnviron;
  fileEnviron = {};
  const paths = [
    process.env.COURSIFY_RUNTIME_ENV_FILE,
    RUNTIME_ENV_FILE,
    DOCKER_ENV_FILE,
  ].filter((p): p is string => typeof p === 'string' && p.length > 0);
  for (const path of paths) {
    try {
      if (!existsSync(path)) continue;
      fileEnviron = parseDotenv(readFileSync(path, 'utf8'));
      return fileEnviron;
    } catch {
      // try next path
    }
  }
  return fileEnviron;
}

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
    // ignore
  }
  return linuxEnviron;
}

function rawEnv(key: string): string | undefined {
  // Docker: mounted .env.production is authoritative for server secrets.
  if (SERVER_SECRET_KEYS.has(key)) {
    const fromFile = readFileEnviron()[key];
    if (typeof fromFile === 'string' && fromFile.length > 0) return fromFile;
  }

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

/** Safe diagnostics for /api/email/status (no secrets). */
export function runtimeEnvDiagnostics(key: string): {
  keyPresent: boolean;
  keyLength: number;
  fileEnvLoaded: boolean;
  fileEnvPath: string | null;
} {
  const file = readFileEnviron();
  const value = runtimeEnv(key);
  const filePath = [
    process.env.COURSIFY_RUNTIME_ENV_FILE,
    RUNTIME_ENV_FILE,
    DOCKER_ENV_FILE,
  ].find((p) => typeof p === 'string' && p.length > 0 && existsSync(p));
  return {
    keyPresent: value !== undefined,
    keyLength: value?.length ?? 0,
    fileEnvLoaded: Object.keys(file).length > 0,
    fileEnvPath: filePath ?? null,
  };
}
