'use client'

/**
 * Stub for root type-check only. Resolves @/lib/supabase-client when root type-checks coursify-app.
 * Real client is in coursify-app/lib/supabase-client.ts.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createClient(): any {
  throw new Error('Supabase client is only available in coursify-app');
}
