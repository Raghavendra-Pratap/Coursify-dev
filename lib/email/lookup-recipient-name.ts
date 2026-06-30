import 'server-only';
import { createServerClient } from '@/lib/supabase-admin';

function nameFromUserMetadata(meta: Record<string, unknown> | undefined): string | undefined {
  if (!meta) return undefined;
  const full = meta.full_name;
  if (typeof full === 'string' && full.trim()) return full.trim();
  const name = meta.name;
  if (typeof name === 'string' && name.trim()) return name.trim();
  return undefined;
}

/** Display name for an invitee, when they already have a Coursify account (Google OAuth / profile). */
export async function lookupRecipientDisplayName(email: string): Promise<string | undefined> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !process.env.SUPABASE_SERVICE_ROLE_KEY) return undefined;

  try {
    const db = createServerClient();
    const { data, error } = await db.auth.admin.getUserByEmail(normalized);
    if (error || !data?.user) return undefined;

    const fromMeta = nameFromUserMetadata(data.user.user_metadata as Record<string, unknown>);
    if (fromMeta) return fromMeta;

    const { data: profile } = await db
      .from('user_profiles')
      .select('full_name')
      .eq('id', data.user.id)
      .maybeSingle();
    const profileName = (profile as { full_name?: string | null } | null)?.full_name?.trim();
    return profileName || undefined;
  } catch {
    return undefined;
  }
}

export async function lookupRecipientDisplayNames(emails: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  await Promise.all(
    unique.map(async (email) => {
      const name = await lookupRecipientDisplayName(email);
      if (name) map.set(email, name);
    }),
  );
  return map;
}
