import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { runtimeEnv } from '@/lib/runtime-env';

/**
 * Server-only Supabase client (service role). Bypasses RLS — use only in API routes
 * and server modules. Never import from 'use client' components.
 */
export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = runtimeEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Server misconfiguration: admin database client unavailable');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
