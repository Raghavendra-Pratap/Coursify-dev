/** Supabase client for Node scripts (Node <22 needs ws transport). */
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

export function createNodeSupabaseClient(url, key) {
  return createClient(url, key, {
    realtime: { transport: ws },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
