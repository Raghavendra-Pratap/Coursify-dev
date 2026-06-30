import 'server-only';
import { createServerClient } from '@/lib/supabase-admin';
import { runtimeEnv } from '@/lib/runtime-env';

function nameFromUserMetadata(meta: Record<string, unknown> | undefined): string | undefined {
  if (!meta) return undefined;
  const full = meta.full_name;
  if (typeof full === 'string' && full.trim()) return full.trim();
  const name = meta.name;
  if (typeof name === 'string' && name.trim()) return name.trim();
  return undefined;
}

async function findAuthUserByEmail(email: string) {
  const db = createServerClient();
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users?.length) return undefined;

    const match = data.users.find((user) => user.email?.trim().toLowerCase() === email);
    if (match) return match;

    if (data.users.length < perPage) return undefined;
    page += 1;
  }
}

/** Display name for an invitee, when they already have a Coursify account (Google OAuth / profile). */
export async function lookupRecipientDisplayName(email: string): Promise<string | undefined> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !runtimeEnv('SUPABASE_SERVICE_ROLE_KEY')) return undefined;

  try {
    const db = createServerClient();
    const user = await findAuthUserByEmail(normalized);
    if (!user) return undefined;

    const fromMeta = nameFromUserMetadata(user.user_metadata as Record<string, unknown>);
    if (fromMeta) return fromMeta;

    const { data: profile } = await db
      .from('user_profiles')
      .select('full_name')
      .eq('id', user.id)
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
  if (unique.length === 0 || !runtimeEnv('SUPABASE_SERVICE_ROLE_KEY')) return map;

  try {
    const db = createServerClient();
    const pending = new Set(unique);
    let page = 1;
    const perPage = 200;

    while (pending.size > 0) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage });
      if (error || !data?.users?.length) break;

      const profileIds: string[] = [];
      const usersByEmail = new Map<string, { id: string; user_metadata: Record<string, unknown> }>();

      for (const user of data.users) {
        const email = user.email?.trim().toLowerCase();
        if (!email || !pending.has(email)) continue;
        pending.delete(email);
        const fromMeta = nameFromUserMetadata(user.user_metadata as Record<string, unknown>);
        if (fromMeta) {
          map.set(email, fromMeta);
          continue;
        }
        profileIds.push(user.id);
        usersByEmail.set(email, { id: user.id, user_metadata: user.user_metadata as Record<string, unknown> });
      }

      if (profileIds.length > 0) {
        const { data: profiles } = await db
          .from('user_profiles')
          .select('id, full_name')
          .in('id', profileIds);
        const profileNameById = new Map(
          (profiles ?? []).map((row) => {
            const profile = row as { id: string; full_name?: string | null };
            return [profile.id, profile.full_name?.trim() || ''] as const;
          }),
        );
        for (const [email, user] of usersByEmail) {
          const profileName = profileNameById.get(user.id);
          if (profileName) map.set(email, profileName);
        }
      }

      if (data.users.length < perPage) break;
      page += 1;
    }
  } catch {
    // ignore lookup failures; invites still send without a resolved name
  }

  return map;
}
