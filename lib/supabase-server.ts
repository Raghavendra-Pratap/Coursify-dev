/**
 * Stub for root type-check only. The root tsconfig type-checks coursify-app;
 * coursify-app uses @/lib/supabase-server, which resolves to this file from root.
 * Real auth routes run in coursify-app and use coursify-app/lib/supabase-server.ts.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createClient(): any {
  throw new Error('Server Supabase client is only available in coursify-app');
}
